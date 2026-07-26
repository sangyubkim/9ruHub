import Decimal from "decimal.js";
import {
  evaluateMarketViability,
  splitIntlShipping,
  type MarketVerdict,
} from "@/lib/pricing/viability";

export type PricingStrategy = "cost_plus_competitor_clamp";

export type RecommendPriceInput = {
  /** 상품 원가 (currency 기준, 기본 KRW) */
  cost: number;
  chinaShipping?: number;
  intlShipping?: number;
  /** 관세 절대액(원). 없으면 dutyRate × cost */
  duty?: number;
  dutyRate?: number;
  cardFeeRate?: number;
  platformFeeRate?: number;
  agencyFee?: number;
  marginRate?: number;
  /** 최소 허용 마진율 — 경쟁가 하향 시 이 아래로 내려가지 않음 */
  minMarginRate?: number;
  /** 경쟁가 대비 목표 할인율 (기본 2%) */
  undercutRate?: number;
  competitors?: number[];
  competitorMin?: number;
  competitorAvg?: number;
  competitorMax?: number;
  roundTo?: number;
  strategy?: PricingStrategy;
  currency?: "KRW" | "USD" | "CNY" | string;
  usdToKrw?: number;
  cnyToKrw?: number;
  /** 시장 천장 배수 (기본 1.15) */
  marketCeilingRate?: number;
  /** 합배송 가정 건수 */
  consolidationUnits?: number;
};

export type CompetitorBand = {
  min: number;
  avg: number;
  max: number;
  count: number;
};

export type RecommendPriceResult = {
  currency: string;
  sourceCostKrw: number;
  chinaShippingKrw: number;
  intlShippingKrw: number;
  dutyKrw: number;
  agencyFeeKrw: number;
  cardFeeRate: number;
  platformFeeRate: number;
  cardFeeKrw: number;
  platformFeeKrw: number;
  marginRate: number;
  marginKrw: number;
  landedCostKrw: number;
  costPlusSaleKrw: number;
  minViableSaleKrw: number;
  competitors: CompetitorBand | null;
  targetSaleKrw: number | null;
  recommendedSalePriceKrw: number;
  strategy: PricingStrategy;
  strategyCode:
    | "cost_plus"
    | "cost_plus_below_market"
    | "competitor_undercut"
    | "competitor_clamp_min_margin";
  marketVerdict: MarketVerdict;
  explanation: string;
  /** draft.costBreakdown 저장용 */
  costBreakdown: Record<string, unknown>;
};

function roundUpTo(value: Decimal, step: number): number {
  if (step <= 0) {
    return value.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
  }
  const dStep = new Decimal(step);
  return value
    .div(dStep)
    .toDecimalPlaces(0, Decimal.ROUND_CEIL)
    .mul(dStep)
    .toNumber();
}

function toKrw(
  amount: number,
  currency: string,
  usdToKrw: number,
  cnyToKrw: number,
): number {
  const cur = currency.toUpperCase();
  if (cur === "USD") return new Decimal(amount).mul(usdToKrw).toNumber();
  if (cur === "CNY") return new Decimal(amount).mul(cnyToKrw).toNumber();
  return amount;
}

export function computeCompetitorBand(
  competitors?: number[],
  competitorMin?: number,
  competitorAvg?: number,
  competitorMax?: number,
): CompetitorBand | null {
  const prices = (competitors ?? []).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return {
      min: Math.round(min),
      avg: Math.round(avg),
      max: Math.round(max),
      count: prices.length,
    };
  }

  if (
    competitorAvg != null &&
    Number.isFinite(competitorAvg) &&
    competitorAvg > 0
  ) {
    const avg = Math.round(competitorAvg);
    const min =
      competitorMin != null && competitorMin > 0
        ? Math.round(competitorMin)
        : avg;
    const max =
      competitorMax != null && competitorMax > 0
        ? Math.round(competitorMax)
        : avg;
    return { min, avg, max, count: 0 };
  }

  return null;
}

function buildExplanation(
  result: Omit<RecommendPriceResult, "explanation" | "costBreakdown">,
): string {
  const parts = [
    `원가 ${result.sourceCostKrw.toLocaleString("ko-KR")}원 + 중국배송 ${result.chinaShippingKrw.toLocaleString("ko-KR")}원 + 국제배송 ${result.intlShippingKrw.toLocaleString("ko-KR")}원 + 관세 ${result.dutyKrw.toLocaleString("ko-KR")}원 + 대행 ${result.agencyFeeKrw.toLocaleString("ko-KR")}원 기준 cost-plus ${result.costPlusSaleKrw.toLocaleString("ko-KR")}원.`,
  ];

  if (!result.competitors) {
    parts.push("경쟁가 정보가 없어 cost-plus 판매가를 그대로 추천합니다.");
  } else if (result.strategyCode === "competitor_undercut") {
    parts.push(
      `경쟁 평균 ${result.competitors.avg.toLocaleString("ko-KR")}원보다 소폭 낮은 ${result.targetSaleKrw?.toLocaleString("ko-KR")}원으로 맞췄습니다.`,
    );
  } else if (result.strategyCode === "competitor_clamp_min_margin") {
    parts.push(
      `경쟁 평균 ${result.competitors.avg.toLocaleString("ko-KR")}원 대비 하향이 필요하지만 최소 마진을 지키기 위해 ${result.recommendedSalePriceKrw.toLocaleString("ko-KR")}원으로 제한했습니다.`,
    );
  } else if (result.strategyCode === "cost_plus_below_market") {
    parts.push(
      `cost-plus가 경쟁 평균(${result.competitors.avg.toLocaleString("ko-KR")}원)보다 낮아 마진을 유지한 채 경쟁력을 확보합니다.`,
    );
  }

  parts.push(
    `추천 판매가 ${result.recommendedSalePriceKrw.toLocaleString("ko-KR")}원 (카드 ${(result.cardFeeRate * 100).toFixed(1)}% · 플랫폼 ${(result.platformFeeRate * 100).toFixed(1)}% 반영).`,
  );
  parts.push(
    `[시장성] ${result.marketVerdict.label}: ${result.marketVerdict.message}`,
  );
  return parts.join(" ");
}

/**
 * 원가+중국/국제배송+관세+대행 → 마진 → 카드/플랫폼 수수료 보정 후,
 * 경쟁가 밴드(평균 소폭 하회)로 클램프하는 결정론적 추천 판매가.
 */
export function recommendSalePrice(
  input: RecommendPriceInput,
): RecommendPriceResult {
  const currency = (input.currency ?? "KRW").toUpperCase();
  const usdToKrw = input.usdToKrw ?? Number(process.env.USD_TO_KRW ?? 1380);
  const cnyToKrw = input.cnyToKrw ?? Number(process.env.CNY_TO_KRW ?? 190);
  const chinaShippingKrw = input.chinaShipping ?? 0;
  const intlShippingKrw = input.intlShipping ?? 0;
  const dutyRate = input.dutyRate ?? Number(process.env.DUTY_RATE ?? 0.08);
  const cardFeeRate = input.cardFeeRate ?? Number(process.env.CARD_FEE_RATE ?? 0.025);
  const platformFeeRate =
    input.platformFeeRate ?? Number(process.env.PLATFORM_FEE_RATE ?? 0.1);
  const agencyFeeKrw =
    input.agencyFee ?? Number(process.env.AGENCY_FEE_KRW ?? 3000);
  const marginRate = input.marginRate ?? Number(process.env.MARGIN_RATE ?? 0.2);
  const minMarginRate =
    input.minMarginRate ?? Number(process.env.MIN_MARGIN_RATE ?? 0.05);
  const undercutRate =
    input.undercutRate ?? Number(process.env.COMPETITOR_UNDERCUT_RATE ?? 0.02);
  const roundTo = input.roundTo ?? 100;
  const strategy: PricingStrategy =
    input.strategy ?? "cost_plus_competitor_clamp";
  const marketCeilingRate =
    input.marketCeilingRate ?? Number(process.env.MARKET_CEILING_RATE ?? 1.15);
  const consolidationUnits = Math.max(
    2,
    input.consolidationUnits ??
      Number(process.env.SHIPPING_CONSOLIDATION_UNITS ?? 5),
  );

  const sourceCostKrw = new Decimal(
    toKrw(input.cost, currency, usdToKrw, cnyToKrw),
  ).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const dutyKrw =
    input.duty != null
      ? new Decimal(input.duty).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      : sourceCostKrw.mul(dutyRate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const landed = sourceCostKrw
    .plus(chinaShippingKrw)
    .plus(intlShippingKrw)
    .plus(dutyKrw)
    .plus(agencyFeeKrw);

  const feeDenom = new Decimal(1).minus(platformFeeRate).minus(cardFeeRate);
  const withMargin = landed.mul(new Decimal(1).plus(marginRate));
  const costPlusRaw = feeDenom.lte(0) ? withMargin : withMargin.div(feeDenom);
  const costPlusSaleKrw = roundUpTo(costPlusRaw, roundTo);

  const minViableRaw = landed.mul(new Decimal(1).plus(minMarginRate));
  const minViableSaleKrw = roundUpTo(
    feeDenom.lte(0) ? minViableRaw : minViableRaw.div(feeDenom),
    roundTo,
  );

  // 합배송 가정: 국제배송만 N등분
  const consolidatedIntl = splitIntlShipping(
    intlShippingKrw,
    consolidationUnits,
  );
  const consolidatedLanded = sourceCostKrw
    .plus(chinaShippingKrw)
    .plus(consolidatedIntl)
    .plus(dutyKrw)
    .plus(agencyFeeKrw);
  const consolidatedMinRaw = consolidatedLanded.mul(
    new Decimal(1).plus(minMarginRate),
  );
  const consolidatedMinViableKrw = roundUpTo(
    feeDenom.lte(0) ? consolidatedMinRaw : consolidatedMinRaw.div(feeDenom),
    roundTo,
  );

  const competitors = computeCompetitorBand(
    input.competitors,
    input.competitorMin,
    input.competitorAvg,
    input.competitorMax,
  );

  let recommendedSalePriceKrw = costPlusSaleKrw;
  let strategyCode: RecommendPriceResult["strategyCode"] = "cost_plus";
  let targetSaleKrw: number | null = null;

  if (strategy === "cost_plus_competitor_clamp" && competitors) {
    targetSaleKrw = roundUpTo(
      new Decimal(competitors.avg).mul(new Decimal(1).minus(undercutRate)),
      roundTo,
    );

    if (costPlusSaleKrw > targetSaleKrw) {
      recommendedSalePriceKrw = Math.max(targetSaleKrw, minViableSaleKrw);
      strategyCode =
        recommendedSalePriceKrw === minViableSaleKrw &&
        minViableSaleKrw > targetSaleKrw
          ? "competitor_clamp_min_margin"
          : "competitor_undercut";
    } else {
      recommendedSalePriceKrw = costPlusSaleKrw;
      strategyCode = "cost_plus_below_market";
    }
  }

  const marketVerdict = evaluateMarketViability({
    minViableSaleKrw,
    costPlusSaleKrw,
    competitorAvgKrw: competitors?.avg ?? null,
    ceilingRate: marketCeilingRate,
    consolidationUnits,
    consolidatedMinViableKrw,
  });

  const sale = new Decimal(recommendedSalePriceKrw);
  const cardFeeKrw = sale
    .mul(cardFeeRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const platformFeeKrw = sale
    .mul(platformFeeRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const marginKrw = sale
    .minus(sourceCostKrw)
    .minus(chinaShippingKrw)
    .minus(intlShippingKrw)
    .minus(dutyKrw)
    .minus(agencyFeeKrw)
    .minus(cardFeeKrw)
    .minus(platformFeeKrw)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  const base = {
    currency,
    sourceCostKrw: sourceCostKrw.toNumber(),
    chinaShippingKrw,
    intlShippingKrw,
    dutyKrw: dutyKrw.toNumber(),
    agencyFeeKrw,
    cardFeeRate,
    platformFeeRate,
    cardFeeKrw,
    platformFeeKrw,
    marginRate,
    marginKrw,
    landedCostKrw: landed.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    costPlusSaleKrw,
    minViableSaleKrw,
    competitors,
    targetSaleKrw,
    recommendedSalePriceKrw,
    strategy,
    strategyCode,
    marketVerdict,
  };

  const explanation = buildExplanation(base);
  const costBreakdown = {
    mode: "ai-price-recommend",
    ...base,
    shippingFeeKrw: chinaShippingKrw + intlShippingKrw,
    salePriceKrw: recommendedSalePriceKrw,
    consolidatedMinViableKrw,
    consolidationUnits,
    explanation,
  };

  return { ...base, explanation, costBreakdown };
}
