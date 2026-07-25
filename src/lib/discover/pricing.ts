import type {
  DemandMetrics,
  JoinedCandidateMetrics,
  SupplyOffer,
} from "@/lib/discover/types";

const DEFAULT_CNY_TO_KRW = Number(process.env.CNY_TO_KRW ?? 190);
const DEFAULT_TARGET_MARGIN = Number(process.env.DISCOVER_TARGET_MARGIN ?? 0.35);
const DEFAULT_LANDED_MULTIPLIER = Number(
  process.env.DISCOVER_LANDED_MULTIPLIER ?? 1.45,
);

/**
 * 수요 메트릭 + 공급 오퍼 → 판매가/마진 추정 후 후보 메트릭으로 결합.
 * 원가(CNY) → 착륙원가(KRW) 대략 추정 후 목표 마진으로 판매가 산출.
 */
export function joinDemandAndSupply(
  demand: DemandMetrics,
  offer: SupplyOffer,
  options?: {
    cnyToKrw?: number;
    targetMargin?: number;
    landedMultiplier?: number;
  },
): JoinedCandidateMetrics {
  const cnyToKrw = options?.cnyToKrw ?? DEFAULT_CNY_TO_KRW;
  const targetMargin = options?.targetMargin ?? DEFAULT_TARGET_MARGIN;
  const landedMultiplier =
    options?.landedMultiplier ?? DEFAULT_LANDED_MULTIPLIER;

  const landedCostKrw = Math.round(
    offer.costPriceCny * cnyToKrw * landedMultiplier,
  );
  const sellPriceKrw = roundTo(
    Math.ceil(landedCostKrw / Math.max(0.05, 1 - targetMargin)),
    100,
  );
  const marginRate =
    sellPriceKrw > 0 ? (sellPriceKrw - landedCostKrw) / sellPriceKrw : 0;

  return {
    keyword: demand.keyword,
    title: `${demand.keyword} · ${offer.title}`,
    sourceDemandMall: demand.mall,
    sourceSupplyMall: offer.mall,
    demandUrl: demand.demandUrl,
    supplyUrl: offer.supplyUrl,
    externalDemandId: demand.externalDemandId,
    externalSupplyId: offer.externalSupplyId,
    searchVolume: demand.searchVolume,
    competition: demand.competition,
    reviewCount: demand.reviewCount,
    rating: demand.rating,
    salesEstimate: demand.salesEstimate,
    costPriceCny: offer.costPriceCny,
    sellPriceKrw,
    marginRate: Math.round(marginRate * 10000) / 10000,
    seasonalityScore: demand.seasonalityScore,
    currency: "CNY",
    isStub: demand.isStub || offer.isStub,
    rawMetrics: {
      demand: demand.raw ?? {},
      supply: offer.raw ?? {},
      pricing: {
        cnyToKrw,
        landedMultiplier,
        landedCostKrw,
        targetMargin,
      },
    },
  };
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}
