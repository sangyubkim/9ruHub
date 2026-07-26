/**
 * 몰테일 미국 항공 요금표 (사용자 제공 스크린샷 기준).
 * - 단위: LBS
 * - 통화: USD (일반회원 단가)
 * - 유류할증료 $1.0 별도 가산 (안내문)
 * 관세·부가세 미포함.
 *
 * 서비스 정책(안내 이미지):
 * - 통관/검수/검역 수수료 무료
 * - 상품보험료 $15 상당 포함
 * - 부피무게 50% 할인
 */

export type MalltailTier = "general" | "platinum";

export type MalltailBracket = {
  maxLbs: number;
  generalUsd: number;
  /** 플래티넘은 안내상 약 10% 할인 — 표 값 우선, 없으면 general*0.9 */
  platinumUsd?: number;
};

/** 몰테일 배대지 부가 정책 (요금 계산·견적 메모용) */
export const MALLTAIL_POLICY = {
  customsClearanceFeeUsd: 0,
  inspectionFeeUsd: 0,
  quarantineFeeUsd: 0,
  includedInsuranceUsd: 15,
  /** 부피무게에 적용 (안내: 50% 할인) */
  volumetricWeightDiscount: 0.5,
  /** 미국 항공 부피무게 제수 (inch³ → lb) */
  dimDivisorInches: 139,
} as const;

export const MALLTAIL_AIR_BRACKETS: MalltailBracket[] = [
  { maxLbs: 0.5, generalUsd: 10.98, platinumUsd: 9.88 },
  { maxLbs: 1, generalUsd: 11.99, platinumUsd: 10.79 },
  { maxLbs: 2, generalUsd: 13.99, platinumUsd: 12.59 },
  { maxLbs: 3, generalUsd: 15.94, platinumUsd: 14.35 },
  { maxLbs: 4, generalUsd: 17.98, platinumUsd: 16.18 },
  { maxLbs: 5, generalUsd: 19.9, platinumUsd: 17.91 },
  { maxLbs: 6, generalUsd: 20.94, platinumUsd: 18.85 },
  { maxLbs: 7, generalUsd: 22.94, platinumUsd: 20.65 },
  { maxLbs: 8, generalUsd: 24.95, platinumUsd: 22.46 },
  { maxLbs: 9, generalUsd: 26.94, platinumUsd: 24.25 },
  { maxLbs: 10, generalUsd: 28.96, platinumUsd: 26.06 },
  { maxLbs: 11, generalUsd: 30.95, platinumUsd: 27.86 },
  { maxLbs: 12, generalUsd: 32.96, platinumUsd: 29.66 },
];

const G_PER_LB = 453.59237;
/** 12 LBS 초과 시 대략 구간 증가분 */
const EXTRA_PER_LB_GENERAL = 2.0;
const EXTRA_PER_LB_PLATINUM = 1.8;

export type MalltailDimsInches = {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export type MalltailAirQuote = {
  provider: "malltail";
  mode: "air";
  tier: MalltailTier;
  weightGrams: number;
  actualLbs: number;
  dimLbs?: number;
  chargeableLbs: number;
  billableLbs: number;
  baseUsd: number;
  fuelSurchargeUsd: number;
  centerFeeUsd: number;
  /** 통관·검수·검역 — 몰테일 무료(0) */
  waivedFeesUsd: {
    customsClearance: number;
    inspection: number;
    quarantine: number;
  };
  includedInsuranceUsd: number;
  volumetricWeightDiscount: number;
  totalUsd: number;
  feeKrw: number;
  usdToKrw: number;
  extrapolated: boolean;
  policyNotes: string[];
};

export function gramsToLbs(weightGrams: number): number {
  return Math.max(0, weightGrams) / G_PER_LB;
}

/** 부피무게(lb) — 할인 전 raw, 할인 후 dimLbs */
export function dimensionalWeightLbs(dims: MalltailDimsInches): {
  rawLbs: number;
  discountedLbs: number;
} {
  const L = Math.max(0, dims.lengthIn);
  const W = Math.max(0, dims.widthIn);
  const H = Math.max(0, dims.heightIn);
  const rawLbs = (L * W * H) / MALLTAIL_POLICY.dimDivisorInches;
  return {
    rawLbs: round2(rawLbs),
    discountedLbs: round2(rawLbs * MALLTAIL_POLICY.volumetricWeightDiscount),
  };
}

/** 실무게 vs (할인 적용) 부피무게 중 큰 값 */
export function chargeableWeightLbs(
  weightGrams: number,
  dims?: MalltailDimsInches,
): { actualLbs: number; dimLbs?: number; chargeableLbs: number } {
  const actualLbs = gramsToLbs(weightGrams);
  if (!dims) {
    return { actualLbs, chargeableLbs: actualLbs };
  }
  const { discountedLbs } = dimensionalWeightLbs(dims);
  return {
    actualLbs,
    dimLbs: discountedLbs,
    chargeableLbs: Math.max(actualLbs, discountedLbs),
  };
}

/** 청구 LBS: 표 구간에 맞게 올림 (최소 0.5) */
export function toBillableLbs(
  weightGrams: number,
  dims?: MalltailDimsInches,
): number {
  const { chargeableLbs } = chargeableWeightLbs(weightGrams, dims);
  if (chargeableLbs <= 0) return 0.5;
  for (const b of MALLTAIL_AIR_BRACKETS) {
    if (chargeableLbs <= b.maxLbs + 1e-9) return b.maxLbs;
  }
  // 12 초과: 1 LBS 단위 올림
  return Math.ceil(chargeableLbs);
}

function baseUsdFor(billableLbs: number, tier: MalltailTier): {
  baseUsd: number;
  extrapolated: boolean;
} {
  const exact = MALLTAIL_AIR_BRACKETS.find(
    (b) => b.maxLbs + 1e-9 >= billableLbs,
  );
  if (exact) {
    const base =
      tier === "platinum"
        ? (exact.platinumUsd ?? exact.generalUsd * 0.9)
        : exact.generalUsd;
    return { baseUsd: round2(base), extrapolated: false };
  }

  const last = MALLTAIL_AIR_BRACKETS[MALLTAIL_AIR_BRACKETS.length - 1]!;
  const extraLbs = billableLbs - last.maxLbs;
  const step = tier === "platinum" ? EXTRA_PER_LB_PLATINUM : EXTRA_PER_LB_GENERAL;
  const lastBase =
    tier === "platinum"
      ? (last.platinumUsd ?? last.generalUsd * 0.9)
      : last.generalUsd;
  return {
    baseUsd: round2(lastBase + extraLbs * step),
    extrapolated: true,
  };
}

export function estimateMalltailAirShipping(
  weightGrams: number,
  options?: {
    tier?: MalltailTier;
    usdToKrw?: number;
    fuelSurchargeUsd?: number;
    centerFeeUsd?: number;
    dimsInches?: MalltailDimsInches;
  },
): MalltailAirQuote {
  const tier = options?.tier ?? "general";
  const usdToKrw = options?.usdToKrw ?? Number(process.env.USD_TO_KRW ?? 1380);
  const fuelSurchargeUsd =
    options?.fuelSurchargeUsd ??
    Number(process.env.MALLTAIL_FUEL_SURCHARGE_USD ?? 1);
  const centerFeeUsd =
    options?.centerFeeUsd ??
    Number(process.env.MALLTAIL_CENTER_FEE_USD ?? 0);

  const { actualLbs, dimLbs, chargeableLbs } = chargeableWeightLbs(
    weightGrams,
    options?.dimsInches,
  );
  const billableLbs = toBillableLbs(weightGrams, options?.dimsInches);
  const { baseUsd, extrapolated } = baseUsdFor(billableLbs, tier);
  // 통관·검수·검역 무료 → 가산 없음. 보험은 포함(별도 청구 없음).
  const waivedFeesUsd = {
    customsClearance: MALLTAIL_POLICY.customsClearanceFeeUsd,
    inspection: MALLTAIL_POLICY.inspectionFeeUsd,
    quarantine: MALLTAIL_POLICY.quarantineFeeUsd,
  };
  const totalUsd = round2(
    baseUsd +
      fuelSurchargeUsd +
      centerFeeUsd +
      waivedFeesUsd.customsClearance +
      waivedFeesUsd.inspection +
      waivedFeesUsd.quarantine,
  );
  const feeKrw = Math.round(totalUsd * usdToKrw);
  const policyNotes = [
    "통관 수수료 무료",
    "검수비 무료",
    "검역비 무료",
    `상품보험료 $${MALLTAIL_POLICY.includedInsuranceUsd} 상당 포함`,
    `부피무게 ${MALLTAIL_POLICY.volumetricWeightDiscount * 100}% 할인`,
  ];

  return {
    provider: "malltail",
    mode: "air",
    tier,
    weightGrams: Math.round(weightGrams),
    actualLbs: round2(actualLbs),
    dimLbs,
    chargeableLbs: round2(chargeableLbs),
    billableLbs,
    baseUsd,
    fuelSurchargeUsd,
    centerFeeUsd,
    waivedFeesUsd,
    includedInsuranceUsd: MALLTAIL_POLICY.includedInsuranceUsd,
    volumetricWeightDiscount: MALLTAIL_POLICY.volumetricWeightDiscount,
    totalUsd,
    feeKrw,
    usdToKrw,
    extrapolated,
    policyNotes,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
