import Decimal from "decimal.js";

export type PriceRuleInput = {
  usdToKrw: number;
  marginRate: number;
  shippingFeeKrw: number;
  agencyFeeKrw: number;
  platformFeeRate: number;
  dutyRate: number;
  roundTo: number;
};

export type CostBreakdown = {
  sourcePriceUsd: number;
  usdToKrw: number;
  sourcePriceKrw: number;
  dutyKrw: number;
  shippingFeeKrw: number;
  agencyFeeKrw: number;
  platformFeeKrw: number;
  marginKrw: number;
  salePriceKrw: number;
};

function roundUpTo(value: Decimal, step: number): number {
  if (step <= 0) return value.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
  const dStep = new Decimal(step);
  return value.div(dStep).toDecimalPlaces(0, Decimal.ROUND_CEIL).mul(dStep).toNumber();
}

/**
 * 판매가 = (원가KRW + 관세 + 배송 + 대행수수료) / (1 - 플랫폼수수료) 후 마진 반영
 * 단순화: 원가·부대비용 합에 마진을 곱하고 플랫폼 수수료를 보정한 뒤 roundTo 단위로 올림
 */
export function calculateSalePrice(
  sourcePriceUsd: number,
  rule: PriceRuleInput,
): CostBreakdown {
  const usd = new Decimal(sourcePriceUsd);
  const rate = new Decimal(rule.usdToKrw);
  const sourcePriceKrw = usd.mul(rate);
  const dutyKrw = sourcePriceKrw.mul(rule.dutyRate);
  const base = sourcePriceKrw
    .plus(dutyKrw)
    .plus(rule.shippingFeeKrw)
    .plus(rule.agencyFeeKrw);

  const withMargin = base.mul(new Decimal(1).plus(rule.marginRate));
  const platformDenom = new Decimal(1).minus(rule.platformFeeRate);
  const beforeRound = platformDenom.lte(0)
    ? withMargin
    : withMargin.div(platformDenom);

  const salePriceKrw = roundUpTo(beforeRound, rule.roundTo);
  const platformFeeKrw = new Decimal(salePriceKrw)
    .mul(rule.platformFeeRate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  const marginKrw = new Decimal(salePriceKrw)
    .minus(sourcePriceKrw)
    .minus(dutyKrw)
    .minus(rule.shippingFeeKrw)
    .minus(rule.agencyFeeKrw)
    .minus(platformFeeKrw)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  return {
    sourcePriceUsd: usd.toNumber(),
    usdToKrw: rate.toNumber(),
    sourcePriceKrw: sourcePriceKrw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    dutyKrw: dutyKrw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    shippingFeeKrw: rule.shippingFeeKrw,
    agencyFeeKrw: rule.agencyFeeKrw,
    platformFeeKrw,
    marginKrw,
    salePriceKrw,
  };
}

export function defaultPriceRuleFromEnv(): PriceRuleInput {
  return {
    usdToKrw: Number(process.env.USD_TO_KRW ?? 1380),
    marginRate: Number(process.env.MARGIN_RATE ?? 0.2),
    shippingFeeKrw: Number(process.env.SHIPPING_FEE_KRW ?? 15000),
    agencyFeeKrw: Number(process.env.AGENCY_FEE_KRW ?? 3000),
    platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.1),
    dutyRate: Number(process.env.DUTY_RATE ?? 0.08),
    roundTo: 100,
  };
}
