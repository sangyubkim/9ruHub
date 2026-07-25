import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export type AnalyticsSnapshot = {
  tenantId: string;
  generatedAt: string;
  revenue: {
    orderCount: number;
    subtotalKrw: number;
    costKrw: number;
    platformFeeKrw: number;
    shippingFeeKrw: number;
    profitKrw: number;
    marginRate: number;
    refundedKrw: number;
  };
  topProducts: Array<{
    productId: string | null;
    title: string;
    quantity: number;
    revenueKrw: number;
    profitKrw: number;
  }>;
  recommendations: {
    total: number;
    pending: number;
    acceptedOrDrafted: number;
    ignored: number;
    avgScore: number;
    conversionRate: number;
  };
  logistics: {
    openShipments: number;
    deliveredShipments: number;
  };
};

/**
 * DB에서만 집계. GPT가 숫자를 만들지 않도록 스냅샷을 컨텍스트로 제공.
 */
export async function buildAnalyticsSnapshot(
  tenantId?: string,
): Promise<AnalyticsSnapshot> {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());

  const orders = await prisma.order.findMany({
    where: {
      tenantId: resolvedTenantId,
      status: { notIn: ["CANCELLED"] },
    },
    include: { items: true },
  });

  const subtotalKrw = orders.reduce((s, o) => s + o.subtotalKrw, 0);
  const costKrw = orders.reduce((s, o) => s + o.costKrw, 0);
  const platformFeeKrw = orders.reduce((s, o) => s + o.platformFeeKrw, 0);
  const shippingFeeKrw = orders.reduce((s, o) => s + o.shippingFeeKrw, 0);
  const profitKrw = orders.reduce((s, o) => s + o.profitKrw, 0);
  const refundedKrw = orders.reduce((s, o) => s + o.refundedKrw, 0);
  const marginRate = subtotalKrw > 0 ? profitKrw / subtotalKrw : 0;

  const productMap = new Map<
    string,
    {
      productId: string | null;
      title: string;
      quantity: number;
      revenueKrw: number;
      profitKrw: number;
    }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const key = item.productId ?? item.title;
      const prev = productMap.get(key) ?? {
        productId: item.productId,
        title: item.title,
        quantity: 0,
        revenueKrw: 0,
        profitKrw: 0,
      };
      prev.quantity += item.quantity;
      prev.revenueKrw += item.unitSalePriceKrw * item.quantity;
      prev.profitKrw += item.lineProfitKrw;
      productMap.set(key, prev);
    }
  }

  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenueKrw - a.revenueKrw)
    .slice(0, 10);

  const [recommendations, openShipments, deliveredShipments] = await Promise.all([
    prisma.aiRecommendation.findMany({
      where: { tenantId: resolvedTenantId },
      select: { status: true, score: true },
    }),
    prisma.shipment.count({
      where: {
        tenantId: resolvedTenantId,
        status: { in: ["PENDING", "AT_FORWARDER", "IN_TRANSIT", "EXCEPTION"] },
      },
    }),
    prisma.shipment.count({
      where: { tenantId: resolvedTenantId, status: "DELIVERED" },
    }),
  ]);
  const total = recommendations.length;
  const pending = recommendations.filter((r) => r.status === "PENDING").length;
  const acceptedOrDrafted = recommendations.filter((r) =>
    ["ACCEPTED", "DRAFT_CREATED", "CONVERTED"].includes(r.status),
  ).length;
  const ignored = recommendations.filter((r) => r.status === "IGNORED").length;
  const avgScore =
    total > 0
      ? recommendations.reduce((s, r) => s + Number(r.score), 0) / total
      : 0;
  const decided = acceptedOrDrafted + ignored;
  const conversionRate = decided > 0 ? acceptedOrDrafted / decided : 0;

  return {
    tenantId: resolvedTenantId,
    generatedAt: new Date().toISOString(),
    revenue: {
      orderCount: orders.length,
      subtotalKrw,
      costKrw,
      platformFeeKrw,
      shippingFeeKrw,
      profitKrw,
      marginRate,
      refundedKrw,
    },
    topProducts,
    recommendations: {
      total,
      pending,
      acceptedOrDrafted,
      ignored,
      avgScore,
      conversionRate,
    },
    logistics: {
      openShipments,
      deliveredShipments,
    },
  };
}
