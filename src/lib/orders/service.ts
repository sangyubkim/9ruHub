import {
  Channel,
  OrderStatus,
  Prisma,
  PurchaseAttemptStatus,
} from "@/generated/prisma/client";
import { getChinaMallAdapter } from "@/lib/china-mall";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type CreateOrderItemInput = {
  productId?: string;
  title: string;
  quantity: number;
  unitSalePriceKrw: number;
  unitCostKrw?: number;
  sourceUrl?: string;
};

export type CreateOrderInput = {
  tenantId?: string;
  channel?: Channel;
  externalOrderId?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: Record<string, unknown>;
  shippingFeeKrw?: number;
  platformFeeKrw?: number;
  notes?: string;
  items: CreateOrderItemInput[];
};

export async function listOrders(tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  return prisma.order.findMany({
    where: { tenantId: resolvedTenantId },
    orderBy: { orderedAt: "desc" },
    include: {
      items: { include: { product: true } },
      shipment: true,
    },
    take: 100,
  });
}

export async function getOrder(orderId: string, tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  return prisma.order.findFirst({
    where: { id: orderId, tenantId: resolvedTenantId },
    include: {
      items: { include: { product: true } },
      shipment: true,
    },
  });
}

export async function createOrder(input: CreateOrderInput) {
  if (!input.items?.length) throw new Error("주문 상품이 필요합니다.");
  const tenantId = input.tenantId ?? (await getDefaultTenantId());

  const normalized = input.items.map((item) => {
    const qty = Math.max(1, item.quantity);
    const unitCost = item.unitCostKrw ?? 0;
    const lineProfit = (item.unitSalePriceKrw - unitCost) * qty;
    return { ...item, quantity: qty, unitCostKrw: unitCost, lineProfitKrw: lineProfit };
  });

  const subtotalKrw = normalized.reduce(
    (sum, i) => sum + i.unitSalePriceKrw * i.quantity,
    0,
  );
  const costKrw = normalized.reduce(
    (sum, i) => sum + i.unitCostKrw * i.quantity,
    0,
  );
  const shippingFeeKrw = input.shippingFeeKrw ?? 0;
  const platformFeeKrw = input.platformFeeKrw ?? 0;
  const profitKrw = subtotalKrw - costKrw - shippingFeeKrw - platformFeeKrw;

  return prisma.order.create({
    data: {
      tenantId,
      channel: input.channel,
      externalOrderId: input.externalOrderId,
      status: OrderStatus.PENDING,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      shippingAddress: input.shippingAddress
        ? toJson(input.shippingAddress)
        : undefined,
      subtotalKrw,
      shippingFeeKrw,
      platformFeeKrw,
      costKrw,
      profitKrw,
      notes: input.notes,
      items: {
        create: normalized.map((item) => ({
          productId: item.productId,
          title: item.title,
          quantity: item.quantity,
          unitSalePriceKrw: item.unitSalePriceKrw,
          unitCostKrw: item.unitCostKrw,
          lineProfitKrw: item.lineProfitKrw,
          sourceUrl: item.sourceUrl,
          purchaseStatus: PurchaseAttemptStatus.STUBBED,
        })),
      },
    },
    include: { items: true, shipment: true },
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: resolvedTenantId },
  });
  if (!order) throw new Error("주문을 찾을 수 없습니다.");

  return prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      purchasedAt:
        status === OrderStatus.PURCHASED || status === OrderStatus.PURCHASE_REQUESTED
          ? order.purchasedAt ?? new Date()
          : order.purchasedAt,
      cancelledAt:
        status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED
          ? new Date()
          : order.cancelledAt,
    },
    include: { items: true, shipment: true },
  });
}

/**
 * 주문 라인에 대해 중국몰 자동주문 어댑터 실행(기본 스텁) 후 상태 기록
 */
export async function purchaseOrderItems(
  orderId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: resolvedTenantId },
    include: { items: true },
  });
  if (!order) throw new Error("주문을 찾을 수 없습니다.");

  const adapter = getChinaMallAdapter();
  const results = [];

  for (const item of order.items) {
    const result = await adapter.purchase({
      orderItemId: item.id,
      title: item.title,
      quantity: item.quantity,
      sourceUrl: item.sourceUrl,
      maxCostKrw: item.unitCostKrw * item.quantity,
    });

    await prisma.orderItem.update({
      where: { id: item.id },
      data: {
        purchaseMall: adapter.name,
        purchaseStatus: result.status as PurchaseAttemptStatus,
        purchaseRef: result.purchaseRef,
        purchasePayload: result.payload ? toJson(result.payload) : undefined,
      },
    });
    results.push({ orderItemId: item.id, ...result });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PURCHASE_REQUESTED,
      purchasedAt: new Date(),
    },
    include: { items: true, shipment: true },
  });

  return { order: updated, results };
}
