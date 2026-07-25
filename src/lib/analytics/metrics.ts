import {
  aggregateRevenueMetrics,
  parseAnalyticsPeriod,
  resolvePeriodRange,
  type AnalyticsPeriod,
  type RevenueMetrics,
} from "@/lib/analytics/kpi";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export type { AnalyticsPeriod } from "@/lib/analytics/kpi";
export {
  aggregateRevenueMetrics,
  computeRefundRate,
  computeRoi,
  isRefundedOrder,
  parseAnalyticsPeriod,
  resolvePeriodRange,
} from "@/lib/analytics/kpi";

export type AnalyticsSnapshot = {
  tenantId: string;
  generatedAt: string;
  period: AnalyticsPeriod;
  periodStart: string | null;
  periodEnd: string;
  revenue: RevenueMetrics;
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
  period: AnalyticsPeriod = "today",
): Promise<AnalyticsSnapshot> {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const resolvedPeriod = parseAnalyticsPeriod(period);
  const { start, end } = resolvePeriodRange(resolvedPeriod);

  const orderWhere = {
    tenantId: resolvedTenantId,
    status: { notIn: ["CANCELLED" as const] },
    ...(start
      ? { orderedAt: { gte: start, lt: end } }
      : { orderedAt: { lt: end } }),
  };

  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: { items: true },
  });

  // DATE 컬럼: end(다음날 자정)는 배타 → lte 전날(= start..오늘)
  const adSpendEndInclusive = new Date(end.getTime() - 86_400_000);
  const adSpendWhere = {
    tenantId: resolvedTenantId,
    ...(start
      ? { date: { gte: start, lte: adSpendEndInclusive } }
      : { date: { lte: adSpendEndInclusive } }),
  };
  const adSpendAgg = await prisma.adSpend.aggregate({
    where: adSpendWhere,
    _sum: { amountKrw: true },
  });
  const adSpendKrw = adSpendAgg._sum.amountKrw ?? 0;

  const revenue = aggregateRevenueMetrics(orders, adSpendKrw);

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

  // Serialize follow-up queries: Prisma local postgres frequently closes
  // connections under nested concurrent load (homepage + analytics).
  const recommendations = await prisma.aiRecommendation.findMany({
    where: { tenantId: resolvedTenantId },
    select: { status: true, score: true },
  });
  const openShipments = await prisma.shipment.count({
    where: {
      tenantId: resolvedTenantId,
      status: { in: ["PENDING", "AT_FORWARDER", "IN_TRANSIT", "EXCEPTION"] },
    },
  });
  const deliveredShipments = await prisma.shipment.count({
    where: { tenantId: resolvedTenantId, status: "DELIVERED" },
  });
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
    period: resolvedPeriod,
    periodStart: start?.toISOString() ?? null,
    periodEnd: end.toISOString(),
    revenue,
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
