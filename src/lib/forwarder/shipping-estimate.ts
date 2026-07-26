import {
  estimateMalltailAirShipping,
  type MalltailTier,
} from "@/lib/forwarder/rates/malltail-air";
import {
  estimateTheBayAirShipping,
  type TheBayAirTier,
} from "@/lib/forwarder/rates/thebay-air";

export type ShippingRegion = "CN" | "US" | "OTHER";

export type IntlShippingQuote = {
  feeKrw: number;
  provider: string;
  mode: string;
  tier: string;
  weightGrams: number;
  billableKg?: number;
  billableLbs?: number;
  totalUsd?: number;
  source: "rate_table" | "flat_env";
  extrapolated?: boolean;
  note?: string;
  /** 몰테일: 통관·검수·검역 무료 등 */
  policyNotes?: string[];
  waivedFeesUsd?: {
    customsClearance: number;
    inspection: number;
    quarantine: number;
  };
  includedInsuranceUsd?: number;
};

function parseTheBayTier(raw: string | undefined): TheBayAirTier {
  const t = (raw ?? "seller").toLowerCase();
  if (t === "vip") return "vip";
  if (t === "first") return "first";
  return "seller";
}

function parseMalltailTier(raw: string | undefined): MalltailTier {
  const t = (raw ?? "general").toLowerCase();
  if (t === "platinum" || t === "plat") return "platinum";
  return "general";
}

/**
 * 국제배송비 추정.
 * - CN: 더베이 항공 kg 요금표
 * - US: 몰테일 항공 LBS 요금표 (+ 유류할증)
 * - FORWARDER_SHIPPING_MODE=flat 이면 고정 배송비
 */
export function estimateIntlShipping(options?: {
  region?: ShippingRegion;
  weightGrams?: number | null;
  /** CN 전용 티어. US는 MALLTAIL_TIER env 사용 */
  tier?: TheBayAirTier;
}): IntlShippingQuote {
  const mode = (process.env.FORWARDER_SHIPPING_MODE ?? "table").toLowerCase();
  const flat = Number(
    process.env.INTL_SHIPPING_FEE_KRW ??
      process.env.SHIPPING_FEE_KRW ??
      15000,
  );
  const defaultWeight = Number(process.env.DEFAULT_SHIPPING_WEIGHT_G ?? 500);
  const weightGrams =
    options?.weightGrams != null &&
    Number.isFinite(options.weightGrams) &&
    options.weightGrams > 0
      ? Number(options.weightGrams)
      : defaultWeight;

  if (mode === "flat") {
    return {
      feeKrw: flat,
      provider: "env",
      mode: "flat",
      tier: "n/a",
      weightGrams,
      billableKg: weightGrams / 1000,
      source: "flat_env",
      note: "FORWARDER_SHIPPING_MODE=flat",
    };
  }

  const region = options?.region ?? "CN";

  if (region === "CN") {
    const tier = options?.tier ?? parseTheBayTier(process.env.THEBAY_AIR_TIER);
    const quote = estimateTheBayAirShipping(weightGrams, tier);
    return {
      feeKrw: quote.feeKrw,
      provider: quote.provider,
      mode: quote.mode,
      tier: quote.tier,
      weightGrams: quote.weightGrams,
      billableKg: quote.billableKg,
      source: "rate_table",
      extrapolated: quote.extrapolated,
      note: "thebay air kg table (KRW)",
    };
  }

  if (region === "US") {
    const tier = parseMalltailTier(process.env.MALLTAIL_TIER);
    const quote = estimateMalltailAirShipping(weightGrams, { tier });
    return {
      feeKrw: quote.feeKrw,
      provider: quote.provider,
      mode: quote.mode,
      tier: quote.tier,
      weightGrams: quote.weightGrams,
      billableLbs: quote.billableLbs,
      totalUsd: quote.totalUsd,
      source: "rate_table",
      extrapolated: quote.extrapolated,
      note: `malltail air lbs + fuel $${quote.fuelSurchargeUsd}` +
        (quote.centerFeeUsd > 0 ? ` + center $${quote.centerFeeUsd}` : "") +
        " · 통관/검수/검역 무료 · 보험 $15 포함 · 부피무게 50%↓",
      policyNotes: quote.policyNotes,
      waivedFeesUsd: quote.waivedFeesUsd,
      includedInsuranceUsd: quote.includedInsuranceUsd,
    };
  }

  return {
    feeKrw: flat,
    provider: "env",
    mode: "flat_fallback",
    tier: "n/a",
    weightGrams,
    billableKg: weightGrams / 1000,
    source: "flat_env",
    note: "기타 지역 → SHIPPING_FEE_KRW 폴백",
  };
}
