import {
  Channel,
  InvoiceRegisterStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from "@/generated/prisma/client";
import {
  getChannelInvoiceAdapter,
  INVOICE_CHANNELS,
  type ChannelInvoiceStatusMap,
} from "@/lib/channels";
import { getForwarderAdapter } from "@/lib/forwarder";
import { prisma } from "@/lib/db";
import { parseChannelList } from "@/lib/shipments/invoice-pipeline-state";
import { getDefaultTenantId } from "@/lib/tenant";

export { nextForwarderSyncAction, parseChannelList } from "@/lib/shipments/invoice-pipeline-state";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asEvents(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? (value as Array<Record<string, unknown>>)
    : [];
}

function parseInvoiceMap(payload: unknown): ChannelInvoiceStatusMap {
  if (!payload || typeof payload !== "object") return {};
  const row = payload as { channels?: ChannelInvoiceStatusMap };
  return row.channels ?? {};
}

function aggregateInvoiceStatus(
  map: ChannelInvoiceStatusMap,
): InvoiceRegisterStatus {
  const values = Object.values(map);
  if (values.length === 0) return InvoiceRegisterStatus.NOT_REQUESTED;
  if (values.some((v) => v.status === "FAILED")) {
    return InvoiceRegisterStatus.FAILED;
  }
  if (values.every((v) => v.status === "SUCCEEDED")) {
    return InvoiceRegisterStatus.SUCCEEDED;
  }
  return InvoiceRegisterStatus.STUBBED;
}

function resolveTargetChannels(
  requested: Channel[] | undefined,
  orderChannel: Channel | null,
): Channel[] {
  if (requested && requested.length > 0) return requested;
  if (orderChannel) return [orderChannel];
  return [...INVOICE_CHANNELS];
}

/**
 * 배대지 동기화 상태 머신:
 * PENDING → pollInbound → AT_FORWARDER
 * AT_FORWARDER → pollOutbound → IN_TRANSIT (+ 국내송장)
 * IN_TRANSIT (송장 없음) → fetchTrackingNumber
 * IN_TRANSIT/이후 → track 갱신
 */
export async function syncShipmentFromForwarder(
  shipmentId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, tenantId: resolvedTenantId },
    include: { order: true },
  });
  if (!shipment) throw new Error("배송건 없음");
  if (shipment.status === ShipmentStatus.CANCELLED) {
    throw new Error("취소된 배송건은 동기화할 수 없습니다.");
  }

  const forwarder = getForwarderAdapter();
  const prevEvents = asEvents(shipment.events);
  const steps: Array<Record<string, unknown>> = [];

  let status = shipment.status;
  let forwarderTrackingNo = shipment.forwarderTrackingNo;
  let forwarderCode = shipment.forwarderCode ?? forwarder.name;
  let localCarrier = shipment.localCarrier;
  let localTrackingNo = shipment.localTrackingNo;
  let shippedAt = shipment.shippedAt;
  let deliveredAt = shipment.deliveredAt;
  let newEvents = [...prevEvents];

  if (status === ShipmentStatus.PENDING) {
    const inbound = await forwarder.pollInbound(shipment.id, forwarderTrackingNo);
    steps.push({ step: "pollInbound", ...inbound });
    if (!inbound.success) {
      throw new Error(inbound.message);
    }
    status = ShipmentStatus.AT_FORWARDER;
    forwarderTrackingNo = inbound.forwarderTrackingNo ?? forwarderTrackingNo;
    newEvents = [...newEvents, ...inbound.events];
  }

  if (status === ShipmentStatus.AT_FORWARDER) {
    const outbound = await forwarder.pollOutbound(
      shipment.id,
      forwarderTrackingNo,
    );
    steps.push({ step: "pollOutbound", ...outbound });
    if (!outbound.success) {
      throw new Error(outbound.message);
    }
    status = ShipmentStatus.IN_TRANSIT;
    forwarderTrackingNo = outbound.forwarderTrackingNo ?? forwarderTrackingNo;
    localCarrier = outbound.localCarrier ?? localCarrier;
    localTrackingNo = outbound.localTrackingNo ?? localTrackingNo;
    shippedAt = shippedAt ?? new Date();
    newEvents = [...newEvents, ...outbound.events];
  }

  if (
    (status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.DELIVERED) &&
    !localTrackingNo
  ) {
    const tracking = await forwarder.fetchTrackingNumber(
      shipment.id,
      forwarderTrackingNo,
    );
    steps.push({ step: "fetchTrackingNumber", ...tracking });
    if (!tracking.success || !tracking.localTrackingNo) {
      throw new Error(tracking.message || "국내 송장번호를 수집하지 못했습니다.");
    }
    localCarrier = tracking.localCarrier || localCarrier;
    localTrackingNo = tracking.localTrackingNo;
    newEvents = [
      ...newEvents,
      {
        at: new Date().toISOString(),
        description: tracking.message,
        mode: tracking.mode,
      },
    ];
  } else if (
    status === ShipmentStatus.IN_TRANSIT ||
    status === ShipmentStatus.EXCEPTION
  ) {
    if (forwarderTrackingNo) {
      const track = await forwarder.track(forwarderTrackingNo);
      steps.push({ step: "track", ...track });
      if (track.success) {
        status = track.status as ShipmentStatus;
        localCarrier = track.localCarrier ?? localCarrier;
        localTrackingNo = track.localTrackingNo ?? localTrackingNo;
        newEvents = [...newEvents, ...track.events];
        if (track.status === "DELIVERED") {
          deliveredAt = deliveredAt ?? new Date();
        }
        shippedAt = shippedAt ?? new Date();
      }
    }
  }

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status,
      forwarderCode,
      forwarderTrackingNo,
      localCarrier,
      localTrackingNo,
      shippedAt,
      deliveredAt,
      events: toJson(newEvents),
    },
    include: { order: { include: { items: true } } },
  });

  if (status === ShipmentStatus.AT_FORWARDER) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: OrderStatus.IN_FORWARDER },
    });
  } else if (status === ShipmentStatus.IN_TRANSIT) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: OrderStatus.SHIPPED_TO_CUSTOMER },
    });
  } else if (status === ShipmentStatus.DELIVERED) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: OrderStatus.DELIVERED },
    });
  }

  return {
    shipment: updated,
    steps,
    mode: forwarder.name.startsWith("stub") ? ("stub" as const) : ("live" as const),
  };
}

/**
 * 국내 송장이 있으면 선택 채널에 송장 등록.
 * 송장 없으면 배대지에서 먼저 수집 시도.
 */
export async function registerInvoiceToChannels(
  shipmentId: string,
  options?: {
    channels?: Channel[];
    tenantId?: string;
    localCarrier?: string;
    localTrackingNo?: string;
  },
) {
  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  let shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, tenantId },
    include: { order: true },
  });
  if (!shipment) throw new Error("배송건 없음");

  if (options?.localCarrier && options?.localTrackingNo) {
    shipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        localCarrier: options.localCarrier,
        localTrackingNo: options.localTrackingNo,
      },
      include: { order: true },
    });
  }

  if (!shipment.localTrackingNo) {
    const synced = await syncShipmentFromForwarder(shipment.id, tenantId);
    shipment = synced.shipment;
  }

  if (!shipment.localTrackingNo || !shipment.localCarrier) {
    throw new Error("국내 송장번호가 없어 채널 등록을 할 수 없습니다.");
  }

  const targets = resolveTargetChannels(options?.channels, shipment.order.channel);
  const prevMap = parseInvoiceMap(shipment.channelInvoicePayload);
  const nextMap: ChannelInvoiceStatusMap = { ...prevMap };
  const results: Array<{
    channel: Channel;
    status: string;
    mode: string;
    message: string;
    success: boolean;
  }> = [];

  for (const channel of targets) {
    const adapter = getChannelInvoiceAdapter(channel);
    const result = await adapter.registerInvoice({
      orderExternalId: shipment.order.externalOrderId,
      localCarrier: shipment.localCarrier,
      localTrackingNo: shipment.localTrackingNo,
    });
    nextMap[channel] = {
      status: result.status,
      mode: result.mode,
      message: result.message,
      success: result.success,
      at: new Date().toISOString(),
    };
    results.push({
      channel,
      status: result.status,
      mode: result.mode,
      message: result.message,
      success: result.success,
    });
  }

  const aggregate = aggregateInvoiceStatus(nextMap);
  const prevEvents = asEvents(shipment.events);
  const logEvents = results.map((r) => ({
    at: new Date().toISOString(),
    description: `[invoice:${r.channel}] ${r.message}`,
    mode: r.mode,
    status: r.status,
  }));

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      channelInvoiceStatus: aggregate,
      channelInvoicePayload: toJson({
        channels: nextMap,
        lastRegisteredAt: new Date().toISOString(),
        results,
      }),
      status:
        shipment.status === ShipmentStatus.AT_FORWARDER ||
        shipment.status === ShipmentStatus.PENDING
          ? ShipmentStatus.IN_TRANSIT
          : shipment.status,
      shippedAt: shipment.shippedAt ?? new Date(),
      events: toJson([...prevEvents, ...logEvents]),
    },
    include: { order: { include: { items: true } } },
  });

  await prisma.order.update({
    where: { id: shipment.orderId },
    data: { status: OrderStatus.SHIPPED_TO_CUSTOMER },
  });

  return {
    shipment: updated,
    results,
    channelInvoiceStatus: aggregate,
    channels: nextMap,
  };
}

export async function syncAllShipmentsFromForwarder(tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const items = await prisma.shipment.findMany({
    where: {
      tenantId: resolvedTenantId,
      status: {
        in: [
          ShipmentStatus.PENDING,
          ShipmentStatus.AT_FORWARDER,
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.EXCEPTION,
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const outcomes: Array<{
    shipmentId: string;
    ok: boolean;
    status?: string;
    error?: string;
  }> = [];

  for (const item of items) {
    try {
      const result = await syncShipmentFromForwarder(item.id, resolvedTenantId);
      outcomes.push({
        shipmentId: item.id,
        ok: true,
        status: result.shipment.status,
      });
    } catch (error) {
      outcomes.push({
        shipmentId: item.id,
        ok: false,
        error: error instanceof Error ? error.message : "동기화 실패",
      });
    }
  }

  return {
    total: items.length,
    succeeded: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    outcomes,
  };
}
