import Decimal from "decimal.js";
import { recommendSalePrice } from "@/lib/pricing/recommend";

export type PriceRuleInput = {
  usdToKrw: number;
  marginRate: number;
  /** 레거시 단일 배송비. china/intl이 없으면 이 값을 국제배송으로 사용 */
  shippingFeeKrw: number;
  agencyFeeKrw: number;
  platformFeeRate: number;
  dutyRate: number;
  roundTo: number;
  /** 중국 내 배송비(원) */
  chinaShippingFeeKrw?: number;
  /** 국제 배송비(원) */
  intlShippingFeeKrw?: number;
  /** 카드 수수료율 */
  cardFeeRate?: number;
  /** 최소 마진율 (추천 클램프용) */
  minMarginRate?: number;
  /** 경쟁가 대비 목표 할인율 */
  undercutRate?: number;
};

export type CostBreakdown = {
  sourcePriceUsd: number;
  usdToKrw: number;
  sourcePriceKrw: number;
  sourceCostKrw?: number;
  dutyKrw: number;
  shippingFeeKrw: number;
  chinaShippingKrw?: number;
  intlShippingKrw?: number;
  agencyFeeKrw: number;
  platformFeeKrw: number;
  cardFeeKrw?: number;
  cardFeeRate?: number;
  platformFeeRate?: number;
  marginKrw: number;
  marginRate?: number;
  salePriceKrw: number;
  landedCostKrw?: number;
  costPlusSaleKrw?: number;
  competitors?: {
    min: number;
    avg: number;
    max: number;
    count: number;
  } | null;
  recommendedSalePriceKrw?: number;
  strategy?: string;
  strategyCode?: string;
  explanation?: string;
  mode?: string;
};

function resolveShipping(rule: PriceRuleInput): {
  chinaShippingKrw: number;
  intlShippingKrw: number;
  shippingFeeKrw: number;
} {
  const hasSplit =
    rule.chinaShippingFeeKrw != null || rule.intlShippingFeeKrw != null;
  if (hasSplit) {
    const chinaShippingKrw = rule.chinaShippingFeeKrw ?? 0;
    const intlShippingKrw = rule.intlShippingFeeKrw ?? 0;
    return {
      chinaShippingKrw,
      intlShippingKrw,
      shippingFeeKrw: chinaShippingKrw + intlShippingKrw,
    };
  }
  return {
    chinaShippingKrw: 0,
    intlShippingKrw: rule.shippingFeeKrw,
    shippingFeeKrw: rule.shippingFeeKrw,
  };
}

function roundUpTo(value: Decimal, step: number): number {
  if (step <= 0) return value.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
  const dStep = new Decimal(step);
  return value.div(dStep).toDecimalPlaces(0, Decimal.ROUND_CEIL).mul(dStep).toNumber();
}

/**
 * 판매가 = (원가KRW + 관세 + 중국/국제배송 + 대행수수료) × (1+마진)
 *          / (1 - 플랫폼수수료 - 카드수수료) 후 roundTo 단위 올림
 */
export function calculateSalePrice(
  sourcePriceUsd: number,
  rule: PriceRuleInput,
  options?: {
    competitors?: number[];
    competitorMin?: number;
    competitorAvg?: number;
    competitorMax?: number;
  },
): CostBreakdown {
  const { chinaShippingKrw, intlShippingKrw, shippingFeeKrw } =
    resolveShipping(rule);
  const cardFeeRate = rule.cardFeeRate ?? 0;

  // 경쟁가가 있으면 추천 엔진으로 통일 계산
  if (
    options?.competitors?.length ||
    options?.competitorAvg != null ||
    options?.competitorMin != null ||
    options?.competitorMax != null
  ) {
    const recommended = recommendSalePrice({
      cost: sourcePriceUsd,
      currency: "USD",
      usdToKrw: rule.usdToKrw,
      chinaShipping: chinaShippingKrw,
      intlShipping: intlShippingKrw,
      dutyRate: rule.dutyRate,
      cardFeeRate,
      platformFeeRate: rule.platformFeeRate,
      agencyFee: rule.agencyFeeKrw,
      marginRate: rule.marginRate,
      minMarginRate: rule.minMarginRate,
      undercutRate: rule.undercutRate,
      roundTo: rule.roundTo,
      competitors: options.competitors,
      competitorMin: options.competitorMin,
      competitorAvg: options.competitorAvg,
      competitorMax: options.competitorMax,
    });

    return {
      sourcePriceUsd,
      usdToKrw: rule.usdToKrw,
      sourcePriceKrw: recommended.sourceCostKrw,
      sourceCostKrw: recommended.sourceCostKrw,
      dutyKrw: recommended.dutyKrw,
      shippingFeeKrw,
      chinaShippingKrw: recommended.chinaShippingKrw,
      intlShippingKrw: recommended.intlShippingKrw,
      agencyFeeKrw: recommended.agencyFeeKrw,
      platformFeeKrw: recommended.platformFeeKrw,
      cardFeeKrw: recommended.cardFeeKrw,
      cardFeeRate: recommended.cardFeeRate,
      platformFeeRate: recommended.platformFeeRate,
      marginKrw: recommended.marginKrw,
      marginRate: recommended.marginRate,
      salePriceKrw: recommended.recommendedSalePriceKrw,
      landedCostKrw: recommended.landedCostKrw,
      costPlusSaleKrw: recommended.costPlusSaleKrw,
      competitors: recommended.competitors,
      recommendedSalePriceKrw: recommended.recommendedSalePriceKrw,
      strategy: recommended.strategy,
      strategyCode: recommended.strategyCode,
      explanation: recommended.explanation,
      mode: "ai-price-recommend",
    };
  }

  const usd = new Decimal(sourcePriceUsd);
  const rate = new Decimal(rule.usdToKrw);
  const sourcePriceKrw = usd.mul(rate);
  const dutyKrw = sourcePriceKrw.mul(rule.dutyRate);
  const base = sourcePriceKrw
    .plus(dutyKrw)
    .plus(chinaShippingKrw)
    .plus(intlShippingKrw)
    .plus(rule.agencyFeeKrw);

  const withMargin = base.mul(new Decimal(1).plus(rule.marginRate));
  const platformDenom = new Decimal(1)
    .minus(rule.platformFeeRate)
    .minus(cardFeeRate);
  const beforeRound = platformDenom.lte(0)
    ? withMargin
    : withMargin.div(platformDenom);

  const salePriceKrw = roundUpTo(beforeRound, rule.roundTo);
  const platformFeeKrw = new Decimal(salePriceKrw)
    .mul(rule.platformFeeRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const cardFeeKrw = new Decimal(salePriceKrw)
    .mul(cardFeeRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const marginKrw = new Decimal(salePriceKrw)
    .minus(sourcePriceKrw)
    .minus(dutyKrw)
    .minus(chinaShippingKrw)
    .minus(intlShippingKrw)
    .minus(rule.agencyFeeKrw)
    .minus(platformFeeKrw)
    .minus(cardFeeKrw)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  return {
    sourcePriceUsd: usd.toNumber(),
    usdToKrw: rate.toNumber(),
    sourcePriceKrw: sourcePriceKrw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    sourceCostKrw: sourcePriceKrw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    dutyKrw: dutyKrw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    shippingFeeKrw,
    chinaShippingKrw,
    intlShippingKrw,
    agencyFeeKrw: rule.agencyFeeKrw,
    platformFeeKrw,
    cardFeeKrw,
    cardFeeRate,
    platformFeeRate: rule.platformFeeRate,
    marginKrw,
    marginRate: rule.marginRate,
    salePriceKrw,
    landedCostKrw: base.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    mode: "cost-plus",
  };
}

export function defaultPriceRuleFromEnv(): PriceRuleInput {
  const chinaShippingFeeKrw = Number(
    process.env.CHINA_SHIPPING_FEE_KRW ?? 0,
  );
  const intlShippingFeeKrw = Number(
    process.env.INTL_SHIPPING_FEE_KRW ??
      process.env.SHIPPING_FEE_KRW ??
      15000,
  );
  const hasSplitEnv =
    process.env.CHINA_SHIPPING_FEE_KRW != null ||
    process.env.INTL_SHIPPING_FEE_KRW != null;

  return {
    usdToKrw: Number(process.env.USD_TO_KRW ?? 1380),
    marginRate: Number(process.env.MARGIN_RATE ?? 0.2),
    shippingFeeKrw: hasSplitEnv
      ? chinaShippingFeeKrw + intlShippingFeeKrw
      : Number(process.env.SHIPPING_FEE_KRW ?? 15000),
    chinaShippingFeeKrw: hasSplitEnv ? chinaShippingFeeKrw : undefined,
    intlShippingFeeKrw: hasSplitEnv ? intlShippingFeeKrw : undefined,
    agencyFeeKrw: Number(process.env.AGENCY_FEE_KRW ?? 3000),
    platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.1),
    dutyRate: Number(process.env.DUTY_RATE ?? 0.08),
    cardFeeRate: Number(process.env.CARD_FEE_RATE ?? 0.025),
    minMarginRate: Number(process.env.MIN_MARGIN_RATE ?? 0.05),
    undercutRate: Number(process.env.COMPETITOR_UNDERCUT_RATE ?? 0.02),
    roundTo: 100,
  };
}
