import {
  InvoiceRegisterStatus,
  OrderStatus,
  Prisma,
  ShipmentStatus,
} from "@/generated/prisma/client";
import { getForwarderAdapter } from "@/lib/forwarder";
import { getInvoiceRegisterAdapter } from "@/lib/invoice";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function listShipments(tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  return prisma.shipment.findMany({
    where: { tenantId: resolvedTenantId },
    orderBy: { createdAt: "desc" },
    include: {
      order: { include: { items: true } },
    },
    take: 100,
  });
}

export async function getShipment(shipmentId: string, tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  return prisma.shipment.findFirst({
    where: { id: shipmentId, tenantId: resolvedTenantId },
    include: { order: { include: { items: true } } },
  });
}

/**
 * 주문에 shipments 행을 만들고 배대지 입고 예약(스텁/live-ready)
 */
export async function createShipmentForOrder(
  orderId: string,
  options?: { tenantId?: string; weightGrams?: number; shippingCostKrw?: number },
) {
  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) throw new Error("주문을 찾을 수 없습니다.");

  const existing = await prisma.shipment.findUnique({ where: { orderId } });
  if (existing) throw new Error("이미 배송건이 존재합니다.");

  const shipment = await prisma.shipment.create({
    data: {
      tenantId,
      orderId,
      status: ShipmentStatus.PENDING,
      weightGrams: options?.weightGrams,
      shippingCostKrw: options?.shippingCostKrw ?? 0,
      events: toJson([]),
    },
  });

  const forwarder = getForwarderAdapter();
  const inbound = await forwarder.createInbound({
    orderId,
    shipmentId: shipment.id,
    customerName: order.customerName,
    shippingAddress: order.shippingAddress,
    weightGrams: options?.weightGrams,
  });

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: ShipmentStatus.AT_FORWARDER,
      forwarderCode: inbound.forwarderCode,
      forwarderTrackingNo: inbound.trackingNo,
      events: toJson([
        {
          at: new Date().toISOString(),
          description: inbound.message,
          mode: inbound.mode,
        },
      ]),
    },
    include: { order: { include: { items: true } } },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.SHIPPED_TO_FORWARDER },
  });

  return { shipment: updated, forwarder: inbound };
}

export async function trackShipment(shipmentId: string, tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, tenantId: resolvedTenantId },
  });
  if (!shipment) throw new Error("배송건 없음");
  if (!shipment.forwarderTrackingNo) throw new Error("배대지 송장번호 없음");

  const forwarder = getForwarderAdapter();
  const track = await forwarder.track(shipment.forwarderTrackingNo);
  const prevEvents = Array.isArray(shipment.events) ? shipment.events : [];

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: track.status as ShipmentStatus,
      events: toJson([...prevEvents, ...track.events]),
      shippedAt: shipment.shippedAt ?? new Date(),
      deliveredAt:
        track.status === "DELIVERED" ? new Date() : shipment.deliveredAt,
    },
    include: { order: true },
  });

  if (track.status === "IN_TRANSIT" || track.status === "DELIVERED") {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        status:
          track.status === "DELIVERED"
            ? OrderStatus.DELIVERED
            : OrderStatus.SHIPPED_TO_CUSTOMER,
      },
    });
  }

  return { shipment: updated, track };
}

/**
 * 국내 송장번호를 채널에 자동등록(스텁)
 */
export async function registerChannelInvoice(
  shipmentId: string,
  input: { localCarrier: string; localTrackingNo: string; tenantId?: string },
) {
  const tenantId = input.tenantId ?? (await getDefaultTenantId());
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, tenantId },
    include: { order: true },
  });
  if (!shipment) throw new Error("배송건 없음");
  if (!shipment.order.channel) {
    throw new Error("채널이 없는 주문은 송장 등록을 건너뜁니다.");
  }

  const adapter = getInvoiceRegisterAdapter();
  const result = await adapter.register({
    channel: shipment.order.channel,
    orderExternalId: shipment.order.externalOrderId,
    localCarrier: input.localCarrier,
    localTrackingNo: input.localTrackingNo,
  });

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      localCarrier: input.localCarrier,
      localTrackingNo: input.localTrackingNo,
      channelInvoiceStatus: result.status as InvoiceRegisterStatus,
      channelInvoicePayload: result.payload ? toJson(result.payload) : undefined,
      status:
        shipment.status === ShipmentStatus.AT_FORWARDER ||
        shipment.status === ShipmentStatus.PENDING
          ? ShipmentStatus.IN_TRANSIT
          : shipment.status,
      shippedAt: shipment.shippedAt ?? new Date(),
    },
    include: { order: true },
  });

  await prisma.order.update({
    where: { id: shipment.orderId },
    data: { status: OrderStatus.SHIPPED_TO_CUSTOMER },
  });

  return { shipment: updated, invoice: result };
}
