import { estimateIntlShipping } from "@/lib/forwarder/shipping-estimate";
import {
  calculateMinViableSaleKrw,
  roundUpToKrw,
  type PriceRuleInput,
} from "@/lib/price-engine";
import type { MarketVerdictCode } from "@/lib/pricing/viability";
import type { MarketType } from "@/lib/recommend/scarcity";

export type SellGrade = "A" | "B" | "C" | "D";
export type RiskLevel = "low" | "medium" | "high";

export type DecisionGuide = {
  /** 상품 원가(환산) + 관세 + 대행 — 국제배송 제외 */
  productCostKrw: number;
  shippingLowKrw: number;
  shippingHighKrw: number;
  shippingMidKrw: number;
  saleLowKrw: number;
  saleHighKrw: number;
  competitorAvgKrw: number | null;
  /** 의사결정용 추천점 (범위 안 1값) */
  recommendedSaleKrw: number;
  minViableSaleKrw: number;
  /** 추천가 기준 예상 순이익 (수수료 차감 후) */
  expectedProfitKrw: number;
  profitLowKrw: number;
  profitHighKrw: number;
  grade: SellGrade;
  gradeLabel: string;
  risk: RiskLevel;
  riskLabel: string;
  competitionStars: number;
  summary: string;
  assumptions: string[];
  /** 시장 유형에 따른 가격 전략 분기 */
  marketType?: MarketType;
};

function costPlusSaleKrw(
  landedCostKrw: number,
  rule: Pick<
    PriceRuleInput,
    "marginRate" | "platformFeeRate" | "cardFeeRate" | "roundTo"
  >,
): number {
  const card = rule.cardFeeRate ?? 0;
  const denom = 1 - rule.platformFeeRate - card;
  const raw =
    denom <= 0
      ? landedCostKrw * (1 + rule.marginRate)
      : (landedCostKrw * (1 + rule.marginRate)) / denom;
  return roundUpToKrw(raw, rule.roundTo);
}

/** 판매가 기준 순이익 ≈ 판매가×(1−플랫폼−카드) − 랜디드원가 */
export function estimateNetProfitKrw(
  salePriceKrw: number,
  landedCostKrw: number,
  platformFeeRate: number,
  cardFeeRate = 0,
): number {
  const net = salePriceKrw * (1 - platformFeeRate - cardFeeRate) - landedCostKrw;
  return Math.round(net);
}

export function shippingFeeRangeKrw(options: {
  weightGrams: number;
  midFeeKrw: number;
  region?: "US" | "CN";
}): { low: number; mid: number; high: number } {
  const w = Math.max(50, options.weightGrams);
  const lowW = Math.max(50, Math.round(w * 0.85));
  const highW = Math.round(w * 1.25);
  const region = options.region ?? "US";
  const low = estimateIntlShipping({ region, weightGrams: lowW }).feeKrw;
  const high = estimateIntlShipping({ region, weightGrams: highW }).feeKrw;
  const mid = options.midFeeKrw;
  return {
    low: Math.min(low, mid, high),
    mid,
    high: Math.max(low, mid, high),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function roundToStep(n: number, step: number): number {
  return roundUpToKrw(n, step);
}

/**
 * 단일 「정답 판매가」대신 범위·추천점·이익·등급을 만든다.
 */
export function buildDecisionGuide(input: {
  productCostKrw: number;
  shippingMidKrw: number;
  weightGrams: number;
  competitorAvgKrw?: number | null;
  marketVerdictCode?: MarketVerdictCode | null;
  isFallback?: boolean;
  weightSource?: "amazon_parse" | "default" | string;
  /** PRICE_WAR=언더컷, SCARCE=마진 확보형 */
  marketType?: MarketType | null;
  rule: Pick<
    PriceRuleInput,
    | "marginRate"
    | "platformFeeRate"
    | "cardFeeRate"
    | "minMarginRate"
    | "roundTo"
    | "undercutRate"
  >;
}): DecisionGuide {
  const rule = input.rule;
  const card = rule.cardFeeRate ?? 0;
  const undercut = rule.undercutRate ?? 0.02;
  const marketType = input.marketType ?? "UNCLEAR";
  const productCostKrw = Math.max(0, Math.round(input.productCostKrw));
  const ship = shippingFeeRangeKrw({
    weightGrams: input.weightGrams,
    midFeeKrw: input.shippingMidKrw,
    region: "US",
  });

  const landedLow = productCostKrw + ship.low;
  const landedMid = productCostKrw + ship.mid;
  const landedHigh = productCostKrw + ship.high;

  // 희소 시장: 목표 마진을 올려 cost-plus 상·하한 확장
  const scarceMargin = Math.min(0.4, Math.max(rule.marginRate, 0.28));
  const warMargin = Math.min(rule.marginRate, 0.1);
  const bandRule =
    marketType === "SCARCE"
      ? { ...rule, marginRate: scarceMargin }
      : marketType === "PRICE_WAR"
        ? { ...rule, marginRate: Math.max(warMargin, rule.minMarginRate ?? 0.05) }
        : rule;

  let saleLowKrw = costPlusSaleKrw(landedLow, bandRule);
  let saleHighKrw = costPlusSaleKrw(
    landedHigh,
    marketType === "SCARCE"
      ? { ...rule, marginRate: Math.min(0.45, scarceMargin + 0.08) }
      : bandRule,
  );
  const costPlusMid = costPlusSaleKrw(landedMid, bandRule);
  const minViableSaleKrw = calculateMinViableSaleKrw(landedMid, rule);

  const competitor =
    input.competitorAvgKrw != null &&
    Number.isFinite(input.competitorAvgKrw) &&
    input.competitorAvgKrw > 0
      ? Math.round(input.competitorAvgKrw)
      : null;

  let recommendedSaleKrw = costPlusMid;
  let summary = "원가·배송·목표 마진으로 산출한 추천가입니다.";

  if (marketType === "SCARCE") {
    // 마진 확보형 — 시세 undercut 하지 않음
    recommendedSaleKrw = Math.max(minViableSaleKrw, costPlusMid);
    if (competitor != null && competitor > recommendedSaleKrw) {
      // 시세가 더 높으면 시세×1.0~1.2 밴드에서 마진 확보
      const premium = roundToStep(competitor * 1.15, rule.roundTo);
      recommendedSaleKrw = Math.max(
        recommendedSaleKrw,
        Math.min(premium, roundToStep(competitor * 1.35, rule.roundTo)),
      );
      saleHighKrw = Math.max(
        saleHighKrw,
        roundToStep(competitor * 1.4, rule.roundTo),
      );
      summary =
        "희소성 시장 — 마진 확보형 추천가입니다. 시세보다 높게 가져가도 됩니다.";
    } else {
      summary =
        "희소성 시장 — 원가+고마진 기준 추천가입니다. 국내 대체품이 적습니다.";
    }
    saleLowKrw = Math.min(saleLowKrw, recommendedSaleKrw);
    saleHighKrw = Math.max(saleHighKrw, recommendedSaleKrw);
  } else if (competitor != null) {
    const target = roundToStep(competitor * (1 - undercut), rule.roundTo);
    if (competitor >= minViableSaleKrw) {
      // 경쟁 시세가 손익분기 이상이면 시세(소폭 하회)를 추천점으로
      recommendedSaleKrw = Math.max(minViableSaleKrw, target);
      if (recommendedSaleKrw < saleLowKrw) {
        recommendedSaleKrw = saleLowKrw;
        summary =
          marketType === "PRICE_WAR"
            ? "가격 경쟁 시장 — 시세가 낮아 저마진 하한으로 맞췄습니다. 판매 신중."
            : "경쟁 시세가 낮아 예상 판매가 하한(목표 마진)으로 맞췄습니다.";
      } else if (recommendedSaleKrw > saleHighKrw) {
        recommendedSaleKrw = saleHighKrw;
        summary =
          "경쟁 시세가 높아 예상 판매가 상한 안에서 추천합니다. 마진 여유 가능.";
      } else {
        summary =
          marketType === "PRICE_WAR"
            ? "가격 경쟁 시장 — 시세 언더컷 추천가입니다. 마진·광고비를 엄격히 보세요."
            : "경쟁 시세에 맞춘 추천가입니다. 범위 안에서 조정하세요.";
      }
    } else {
      recommendedSaleKrw = Math.max(minViableSaleKrw, costPlusMid);
      summary =
        "경쟁 시세가 손익분기 아래라 원가 기준으로 추천합니다. 시장 진입 시 주의.";
    }
  } else if (marketType === "PRICE_WAR") {
    summary =
      "가격 경쟁 시장 — 시세 데이터 부족. 국내 최저가에 근접해야만 판매 가능성이 있습니다.";
  }

  recommendedSaleKrw = Math.max(recommendedSaleKrw, minViableSaleKrw);

  const expectedProfitKrw = estimateNetProfitKrw(
    recommendedSaleKrw,
    landedMid,
    rule.platformFeeRate,
    card,
  );
  const profitLowKrw = estimateNetProfitKrw(
    saleLowKrw,
    landedHigh,
    rule.platformFeeRate,
    card,
  );
  const profitHighKrw = estimateNetProfitKrw(
    saleHighKrw,
    landedLow,
    rule.platformFeeRate,
    card,
  );

  const profitRate =
    recommendedSaleKrw > 0 ? expectedProfitKrw / recommendedSaleKrw : 0;

  let grade: SellGrade = "C";
  let gradeLabel = "보통";
  if (input.isFallback) {
    grade = "D";
    gradeLabel = "데이터 부족";
  } else if (marketType === "PRICE_WAR") {
    grade = expectedProfitKrw > 0 && profitRate >= 0.08 ? "C" : "D";
    gradeLabel = grade === "C" ? "저마진 경쟁" : "비추천";
  } else if (
    marketType === "SCARCE" &&
    recommendedSaleKrw >= minViableSaleKrw &&
    profitRate >= 0.1 &&
    input.marketVerdictCode !== "NOT_RECOMMENDED"
  ) {
    grade = "A";
    gradeLabel = "희소·마진 유망";
  } else if (
    competitor != null &&
    recommendedSaleKrw >= minViableSaleKrw &&
    profitRate >= 0.12 &&
    input.marketVerdictCode !== "NOT_RECOMMENDED"
  ) {
    grade = "A";
    gradeLabel = "판매 유망";
  } else if (
    recommendedSaleKrw >= minViableSaleKrw &&
    profitRate >= 0.08 &&
    input.marketVerdictCode !== "NOT_RECOMMENDED"
  ) {
    grade = "B";
    gradeLabel = "검토 가능";
  } else if (recommendedSaleKrw >= minViableSaleKrw) {
    grade = "C";
    gradeLabel = "보통";
  } else {
    grade = "D";
    gradeLabel = "비추천";
  }

  let risk: RiskLevel = "medium";
  let riskLabel = "보통";
  if (
    input.isFallback ||
    input.marketVerdictCode === "NOT_RECOMMENDED" ||
    expectedProfitKrw < 0 ||
    marketType === "PRICE_WAR"
  ) {
    risk = "high";
    riskLabel = "높음";
  } else if (
    marketType === "SCARCE" &&
    input.weightSource === "amazon_parse" &&
    profitRate >= 0.1
  ) {
    risk = "low";
    riskLabel = "낮음";
  } else if (
    input.weightSource === "amazon_parse" &&
    competitor != null &&
    profitRate >= 0.1
  ) {
    risk = "low";
    riskLabel = "낮음";
  } else if (competitor == null) {
    risk = "high";
    riskLabel = "높음";
  }

  let competitionStars = 1;
  if (competitor != null && competitor > 0) {
    const ratio = recommendedSaleKrw / competitor;
    if (ratio <= 1.05 && ratio >= 0.9 && profitRate >= 0.1) competitionStars = 5;
    else if (ratio <= 1.12 && profitRate >= 0.08) competitionStars = 4;
    else if (ratio <= 1.2) competitionStars = 3;
    else if (ratio <= 1.35) competitionStars = 2;
    else competitionStars = 1;
  } else if (profitRate >= 0.15) {
    competitionStars = 3;
  }

  const assumptions = [
    `시장 유형 ${marketType}`,
    `상품원가(관세·대행 포함, 배송 제외) ${productCostKrw.toLocaleString("ko-KR")}원`,
    `국제배송 ${ship.low.toLocaleString("ko-KR")}~${ship.high.toLocaleString("ko-KR")}원 (무게 ± 요금표)`,
    `플랫폼 ${(rule.platformFeeRate * 100).toFixed(0)}% · 카드 ${(card * 100).toFixed(1)}% · 목표마진 ${(bandRule.marginRate * 100).toFixed(0)}%`,
    input.weightSource === "default"
      ? "무게는 기본 추정값(수동 입력을 권장)"
      : "무게는 Amazon/수동 입력 기준",
  ];

  return {
    productCostKrw,
    shippingLowKrw: ship.low,
    shippingHighKrw: ship.high,
    shippingMidKrw: ship.mid,
    saleLowKrw: Math.min(saleLowKrw, saleHighKrw),
    saleHighKrw: Math.max(saleLowKrw, saleHighKrw),
    competitorAvgKrw: competitor,
    recommendedSaleKrw,
    minViableSaleKrw,
    expectedProfitKrw,
    profitLowKrw: Math.min(profitLowKrw, profitHighKrw, expectedProfitKrw),
    profitHighKrw: Math.max(profitLowKrw, profitHighKrw, expectedProfitKrw),
    grade,
    gradeLabel,
    risk,
    riskLabel,
    competitionStars: clamp(competitionStars, 1, 5),
    summary,
    assumptions,
    marketType,
  };
}
