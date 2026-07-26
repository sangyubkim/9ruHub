/**
 * 더베이(TheBay) 항공 요금표 (사용자 제공 스크린샷 기준).
 * 관세·부가세 미포함.
 */

export type TheBayAirTier = "vip" | "seller" | "first";

export type TheBayAirBracket = {
  maxKg: number;
  vip: number;
  seller: number;
  first: number;
};

/** 0.5kg 단위 구간 (이상이면 해당 구간, 무게는 올림 매칭) */
export const THEBAY_AIR_BRACKETS: TheBayAirBracket[] = [
  { maxKg: 0.5, vip: 4200, seller: 3200, first: 3200 },
  { maxKg: 1.0, vip: 6200, seller: 5000, first: 5000 },
  { maxKg: 1.5, vip: 8200, seller: 6800, first: 6800 },
  { maxKg: 2.0, vip: 10200, seller: 8600, first: 8600 },
  { maxKg: 2.5, vip: 12200, seller: 10400, first: 10400 },
  { maxKg: 3.0, vip: 14200, seller: 12200, first: 12200 },
  { maxKg: 3.5, vip: 16200, seller: 14000, first: 14000 },
  { maxKg: 4.0, vip: 18200, seller: 15800, first: 15800 },
];

const STEP_KG = 0.5;
const VIP_STEP_FEE = 2000;
const SELLER_STEP_FEE = 1800;

export type TheBayAirQuote = {
  provider: "thebay";
  mode: "air";
  tier: TheBayAirTier;
  weightGrams: number;
  billableKg: number;
  feeKrw: number;
  extrapolated: boolean;
};

function feeForTier(bracket: TheBayAirBracket, tier: TheBayAirTier): number {
  if (tier === "vip") return bracket.vip;
  if (tier === "first") return bracket.first;
  return bracket.seller;
}

/** 청구 무게: 0.5kg 단위 올림 (최소 0.5kg) */
export function toBillableKg(weightGrams: number): number {
  const kg = Math.max(0, weightGrams) / 1000;
  if (kg <= 0) return STEP_KG;
  return Math.ceil(kg / STEP_KG) * STEP_KG;
}

export function estimateTheBayAirShipping(
  weightGrams: number,
  tier: TheBayAirTier = "seller",
): TheBayAirQuote {
  const billableKg = toBillableKg(weightGrams);
  const exact = THEBAY_AIR_BRACKETS.find((b) => b.maxKg + 1e-9 >= billableKg);
  if (exact) {
    return {
      provider: "thebay",
      mode: "air",
      tier,
      weightGrams: Math.round(weightGrams),
      billableKg,
      feeKrw: feeForTier(exact, tier),
      extrapolated: false,
    };
  }

  // 4kg 초과: 마지막 구간 + 0.5kg마다 step fee
  const last = THEBAY_AIR_BRACKETS[THEBAY_AIR_BRACKETS.length - 1]!;
  const steps = Math.round((billableKg - last.maxKg) / STEP_KG);
  const stepFee = tier === "vip" ? VIP_STEP_FEE : SELLER_STEP_FEE;
  return {
    provider: "thebay",
    mode: "air",
    tier,
    weightGrams: Math.round(weightGrams),
    billableKg,
    feeKrw: feeForTier(last, tier) + steps * stepFee,
    extrapolated: true,
  };
}
