export type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

export type OrderMetricRow = {
  status: string;
  subtotalKrw: number;
  costKrw: number;
  platformFeeKrw: number;
  shippingFeeKrw: number;
  profitKrw: number;
  refundedKrw: number;
};

export type RevenueMetrics = {
  orderCount: number;
  subtotalKrw: number;
  costKrw: number;
  platformFeeKrw: number;
  shippingFeeKrw: number;
  profitKrw: number;
  marginRate: number;
  refundedKrw: number;
  refundedOrderCount: number;
  refundRate: number;
  adSpendKrw: number;
  roi: number;
};

/** ROI = 순이익 / 광고비 (광고비 0이면 0) */
export function computeRoi(profitKrw: number, adSpendKrw: number): number {
  if (adSpendKrw <= 0) return 0;
  return profitKrw / adSpendKrw;
}

/** 환불률 = 환불 주문 수 / 전체 주문 수 */
export function computeRefundRate(
  refundedOrderCount: number,
  totalOrderCount: number,
): number {
  if (totalOrderCount <= 0) return 0;
  return refundedOrderCount / totalOrderCount;
}

export function isRefundedOrder(order: {
  status: string;
  refundedKrw: number;
}): boolean {
  return order.status === "REFUNDED" || order.refundedKrw > 0;
}

/**
 * Asia/Seoul 기준 기간 범위.
 * end는 배타적 상한(다음날 서울 자정) — `orderedAt < end` 로 조회.
 * "오늘"에 현재 시각 이후 타임스탬프(데모 시드 등)도 포함된다.
 */
export function resolvePeriodRange(
  period: AnalyticsPeriod,
  now: Date = new Date(),
): { start: Date | null; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  const seoulTodayStart = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  const seoulTomorrowStart = new Date(
    seoulTodayStart.getTime() + 86_400_000,
  );

  if (period === "all") {
    return { start: null, end: seoulTomorrowStart };
  }
  if (period === "today") {
    return { start: seoulTodayStart, end: seoulTomorrowStart };
  }
  const daysBack = period === "7d" ? 6 : 29;
  const start = new Date(seoulTodayStart.getTime() - daysBack * 86_400_000);
  return { start, end: seoulTomorrowStart };
}

export function parseAnalyticsPeriod(
  value: string | null | undefined,
): AnalyticsPeriod {
  if (value === "7d" || value === "30d" || value === "all" || value === "today") {
    return value;
  }
  return "today";
}

export function aggregateRevenueMetrics(
  orders: OrderMetricRow[],
  adSpendKrw: number,
): RevenueMetrics {
  const subtotalKrw = orders.reduce((s, o) => s + o.subtotalKrw, 0);
  const costKrw = orders.reduce((s, o) => s + o.costKrw, 0);
  const platformFeeKrw = orders.reduce((s, o) => s + o.platformFeeKrw, 0);
  const shippingFeeKrw = orders.reduce((s, o) => s + o.shippingFeeKrw, 0);
  const profitKrw = orders.reduce((s, o) => s + o.profitKrw, 0);
  const refundedKrw = orders.reduce((s, o) => s + o.refundedKrw, 0);
  const refundedOrderCount = orders.filter(isRefundedOrder).length;
  const orderCount = orders.length;
  const marginRate = subtotalKrw > 0 ? profitKrw / subtotalKrw : 0;

  return {
    orderCount,
    subtotalKrw,
    costKrw,
    platformFeeKrw,
    shippingFeeKrw,
    profitKrw,
    marginRate,
    refundedKrw,
    refundedOrderCount,
    refundRate: computeRefundRate(refundedOrderCount, orderCount),
    adSpendKrw,
    roi: computeRoi(profitKrw, adSpendKrw),
  };
}
