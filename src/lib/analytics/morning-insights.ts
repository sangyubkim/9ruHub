export type MorningInsightKind =
  | "SALES_CHANGE"
  | "COMPETITOR_PRICE"
  | "STOCK_RISK"
  | "AD_PAUSE"
  | "INFO";

export type MorningInsight = {
  kind: MorningInsightKind;
  severity: "info" | "warn" | "critical";
  productTitle?: string;
  message: string;
  data: Record<string, number | string | boolean | null>;
};

export type DaySalesSlice = {
  orderCount: number;
  revenueKrw: number;
  profitKrw: number;
  refundedKrw: number;
};

export type CompetitorPriceDrop = {
  productTitle: string;
  dropKrw: number;
  previousKrw: number;
  currentKrw: number;
};

export type StockRiskItem = {
  productTitle: string;
  stockQty: number;
  inStock: boolean;
  recentSold: number;
};

export type AdPauseItem = {
  productTitle: string;
  profitKrw: number;
  refundCount: number;
  totalSold: number;
  reason: string;
};

/**
 * 순수 함수: DB 집계 결과 → 아침 보고서 인사이트 목록
 * (GPT는 이 목록을 문장으로만 다듬음)
 */
export function buildMorningInsights(input: {
  yesterday: DaySalesSlice;
  dayBefore: DaySalesSlice;
  competitorDrops: CompetitorPriceDrop[];
  stockRisks: StockRiskItem[];
  adPauses: AdPauseItem[];
}): MorningInsight[] {
  const insights: MorningInsight[] = [];
  const { yesterday, dayBefore } = input;

  if (dayBefore.revenueKrw > 0) {
    const change =
      ((yesterday.revenueKrw - dayBefore.revenueKrw) / dayBefore.revenueKrw) *
      100;
    const rounded = Math.round(change * 10) / 10;
    insights.push({
      kind: "SALES_CHANGE",
      severity: rounded < -10 ? "warn" : "info",
      message:
        rounded >= 0
          ? `어제보다 매출이 ${rounded}% 증가했습니다.`
          : `어제보다 매출이 ${Math.abs(rounded)}% 감소했습니다.`,
      data: {
        yesterdayRevenueKrw: yesterday.revenueKrw,
        dayBeforeRevenueKrw: dayBefore.revenueKrw,
        changePct: rounded,
        yesterdayOrders: yesterday.orderCount,
        yesterdayProfitKrw: yesterday.profitKrw,
      },
    });
  } else if (yesterday.revenueKrw > 0) {
    insights.push({
      kind: "SALES_CHANGE",
      severity: "info",
      message: `어제 매출 ${yesterday.revenueKrw.toLocaleString("ko-KR")}원(${yesterday.orderCount}건)을 기록했습니다. (전일 비교 데이터 없음)`,
      data: {
        yesterdayRevenueKrw: yesterday.revenueKrw,
        dayBeforeRevenueKrw: 0,
        changePct: null,
        yesterdayOrders: yesterday.orderCount,
        yesterdayProfitKrw: yesterday.profitKrw,
      },
    });
  } else {
    insights.push({
      kind: "INFO",
      severity: "info",
      message: "어제 매출 데이터가 없습니다.",
      data: {
        yesterdayRevenueKrw: 0,
        dayBeforeRevenueKrw: dayBefore.revenueKrw,
        changePct: null,
      },
    });
  }

  for (const drop of input.competitorDrops.slice(0, 5)) {
    insights.push({
      kind: "COMPETITOR_PRICE",
      severity: drop.dropKrw >= 2000 ? "warn" : "info",
      productTitle: drop.productTitle,
      message: `${drop.productTitle}은(는) 경쟁가(판매가)가 ${drop.dropKrw.toLocaleString("ko-KR")}원 인하되었습니다.`,
      data: {
        dropKrw: drop.dropKrw,
        previousKrw: drop.previousKrw,
        currentKrw: drop.currentKrw,
      },
    });
  }

  for (const risk of input.stockRisks.slice(0, 5)) {
    insights.push({
      kind: "STOCK_RISK",
      severity: !risk.inStock || risk.stockQty <= 0 ? "critical" : "warn",
      productTitle: risk.productTitle,
      message: `${risk.productTitle}은(는) 재고 부족 가능성이 있습니다.`,
      data: {
        stockQty: risk.stockQty,
        inStock: risk.inStock,
        recentSold: risk.recentSold,
      },
    });
  }

  for (const ad of input.adPauses.slice(0, 5)) {
    insights.push({
      kind: "AD_PAUSE",
      severity: "warn",
      productTitle: ad.productTitle,
      message: `${ad.productTitle}은(는) 광고를 중단하는 것이 좋습니다.`,
      data: {
        profitKrw: ad.profitKrw,
        refundCount: ad.refundCount,
        totalSold: ad.totalSold,
        reason: ad.reason,
      },
    });
  }

  return insights;
}

export function templateMorningNarrative(
  reportDate: string,
  insights: MorningInsight[],
): string {
  const lines = [
    `📅 운영 비서 아침 보고서 (${reportDate})`,
    "",
    ...insights.map((i, idx) => `${idx + 1}. ${i.message}`),
    "",
    "※ 숫자는 DB 집계 기준이며, AI가 새로 만들지 않았습니다.",
  ];
  return lines.join("\n");
}
