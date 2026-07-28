import type { CompetitorSample } from "@/lib/discover/demand/naver-competitors";
import type { AmazonShipEligibility } from "@/lib/amazon/ship-eligibility";
import type { MarketVerdict } from "@/lib/pricing/viability";
import type { ShippingDetail } from "@/lib/recommend/amazon-enrich";
import {
  buildDecisionGuide,
  type DecisionGuide,
} from "@/lib/recommend/decision-guide";
import {
  buildProductViability,
  type ProductViability,
} from "@/lib/recommend/product-viability";
import type { ScoreBreakdown } from "@/lib/recommend/score";

export type AmazonScoreFeatureExtras = {
  intlShippingKrw?: number | null;
  competitorAvgKrw?: number | null;
  competitorSamples?: CompetitorSample[] | null;
  minViableSaleKrw?: number | null;
  marketVerdict?: MarketVerdict | null;
  isFallback?: boolean;
  naverKeyword?: string | null;
  /** 네이버 수요 상품/검색 링크 (Amazon 부착 후에도 유지) */
  naverDemandUrl?: string | null;
  naverSearchUrl?: string | null;
  naverProductLink?: string | null;
  targetMarginRate?: number | null;
  shipping?: ShippingDetail | null;
  /** 주간 수요 카드에 Amazon URL을 붙인 뒤 false */
  needsAmazonUrl?: boolean;
  /** 의사결정 가이드(범위·이익·등급). 없으면 priced로 생성 */
  decisionGuide?: DecisionGuide | null;
  productViability?: ProductViability | null;
  title?: string | null;
  brand?: string | null;
  shopTotal?: number | null;
  uniqueMallCount?: number | null;
  sameLikelyCount?: number | null;
  competitorPrices?: number[] | null;
  searchVolume?: number | null;
  competition?: number | null;
  seasonalityScore?: number | null;
  reviewCount?: number | null;
  shipEligibility?: AmazonShipEligibility | null;
};

/** UI(RecommendEconomics)가 읽는 features 형태로 Amazon 점수 breakdown 저장 */
export function withAmazonScoreFeatures(
  breakdown: ScoreBreakdown,
  priced: {
    salePriceKrw: number;
    costKrw: number;
    /** 상품 환산 원가(배송 제외). 없으면 cost−국제배송 */
    sourcePriceKrw?: number;
    productCostKrw?: number;
    weightGrams?: number;
    targetMarginRate?: number;
    platformFeeRate?: number;
    cardFeeRate?: number;
    minMarginRate?: number;
    undercutRate?: number;
    roundTo?: number;
    intlShippingKrw?: number;
    minViableSaleKrw?: number;
    shipping?: ShippingDetail;
  },
  sourcePriceUsd: number,
  extras?: AmazonScoreFeatureExtras,
) {
  const marginRate =
    priced.salePriceKrw > 0
      ? (priced.salePriceKrw - priced.costKrw) / priced.salePriceKrw
      : 0;
  const intl = extras?.intlShippingKrw ?? priced.intlShippingKrw ?? 0;
  const sourceCostKrw =
    priced.sourcePriceKrw != null
      ? Math.round(priced.sourcePriceKrw)
      : Math.max(0, Math.round(priced.costKrw - intl));
  const productCostKrw =
    priced.productCostKrw ??
    Math.max(0, Math.round(priced.costKrw - intl));

  const scarcitySeed = buildProductViability({
    keyword: extras?.naverKeyword,
    title: extras?.title,
    brand: extras?.brand,
    shopTotal: extras?.shopTotal,
    uniqueMallCount: extras?.uniqueMallCount,
    prices: extras?.competitorPrices,
    sameLikelyCount: extras?.sameLikelyCount,
    searchVolume: extras?.searchVolume,
    competition: extras?.competition,
    seasonalityScore: extras?.seasonalityScore,
    reviewCount: extras?.reviewCount,
    weightGrams: priced.weightGrams,
    competitorAvgKrw: extras?.competitorAvgKrw,
    marketVerdictCode: extras?.marketVerdict?.code ?? null,
    minViableSaleKrw: extras?.minViableSaleKrw ?? priced.minViableSaleKrw,
    shipEligibility: extras?.shipEligibility,
  });

  const decisionGuide =
    extras?.decisionGuide ??
    (priced.platformFeeRate != null &&
    priced.weightGrams != null &&
    priced.targetMarginRate != null
      ? buildDecisionGuide({
          productCostKrw,
          shippingMidKrw: intl,
          weightGrams: priced.weightGrams,
          competitorAvgKrw: extras?.competitorAvgKrw,
          marketVerdictCode: extras?.marketVerdict?.code ?? null,
          isFallback: extras?.isFallback,
          weightSource:
            extras?.shipping?.weightSource ?? priced.shipping?.weightSource,
          marketType: scarcitySeed.marketType,
          rule: {
            marginRate: priced.targetMarginRate,
            platformFeeRate: priced.platformFeeRate,
            cardFeeRate: priced.cardFeeRate ?? 0,
            minMarginRate: priced.minMarginRate ?? 0.05,
            undercutRate: priced.undercutRate ?? 0.02,
            roundTo: priced.roundTo ?? 100,
          },
        })
      : null);

  const productViability =
    extras?.productViability ??
    buildProductViability({
      keyword: extras?.naverKeyword,
      title: extras?.title,
      brand: extras?.brand,
      shopTotal: extras?.shopTotal,
      uniqueMallCount: extras?.uniqueMallCount,
      prices: extras?.competitorPrices,
      sameLikelyCount: extras?.sameLikelyCount,
      searchVolume: extras?.searchVolume,
      competition: extras?.competition,
      seasonalityScore: extras?.seasonalityScore,
      reviewCount: extras?.reviewCount,
      weightGrams: priced.weightGrams,
      competitorAvgKrw: extras?.competitorAvgKrw,
      marketVerdictCode: extras?.marketVerdict?.code ?? null,
      decisionGuide,
      minViableSaleKrw:
        decisionGuide?.minViableSaleKrw ??
        extras?.minViableSaleKrw ??
        priced.minViableSaleKrw,
      shipEligibility: extras?.shipEligibility,
    });

  return {
    ...breakdown,
    features: {
      sellPriceKrw:
        decisionGuide?.recommendedSaleKrw ?? priced.salePriceKrw,
      costPlusSaleKrw: priced.salePriceKrw,
      sourceCostKrw,
      landedCostKrw: priced.costKrw,
      productCostKrw,
      sourcePriceUsd,
      marginRate,
      targetMarginRate: extras?.targetMarginRate ?? priced.targetMarginRate ?? null,
      intlShippingKrw: intl || null,
      competitorAvgKrw: extras?.competitorAvgKrw ?? null,
      competitorSamples: extras?.competitorSamples ?? [],
      minViableSaleKrw:
        decisionGuide?.minViableSaleKrw ??
        extras?.minViableSaleKrw ??
        priced.minViableSaleKrw ??
        null,
      isFallback: Boolean(extras?.isFallback),
      naverKeyword: extras?.naverKeyword ?? null,
      naverDemandUrl: extras?.naverDemandUrl ?? null,
      naverSearchUrl: extras?.naverSearchUrl ?? null,
      naverProductLink: extras?.naverProductLink ?? null,
      shipping: extras?.shipping ?? priced.shipping ?? null,
      needsAmazonUrl: extras?.needsAmazonUrl === true,
      awaitingAmazon: extras?.needsAmazonUrl === true,
      decisionGuide,
      productViability,
      shopTotal: extras?.shopTotal ?? null,
      uniqueMallCount: extras?.uniqueMallCount ?? null,
      shipEligibility: extras?.shipEligibility ?? null,
      sourcingFit: productViability.sourcingFit ?? null,
      krDirectShip: extras?.shipEligibility?.krDirectShip ?? null,
      usForwarderOk: extras?.shipEligibility?.usForwarderOk ?? null,
    },
    marketVerdict: extras?.marketVerdict ?? null,
  };
}
