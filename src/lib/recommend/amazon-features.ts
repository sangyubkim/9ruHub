import type { CompetitorSample } from "@/lib/discover/demand/naver-competitors";
import type { MarketVerdict } from "@/lib/pricing/viability";
import type { ShippingDetail } from "@/lib/recommend/amazon-enrich";
import type { ScoreBreakdown } from "@/lib/recommend/score";

export type AmazonScoreFeatureExtras = {
  intlShippingKrw?: number | null;
  competitorAvgKrw?: number | null;
  competitorSamples?: CompetitorSample[] | null;
  minViableSaleKrw?: number | null;
  marketVerdict?: MarketVerdict | null;
  isFallback?: boolean;
  naverKeyword?: string | null;
  targetMarginRate?: number | null;
  shipping?: ShippingDetail | null;
};

/** UI(RecommendEconomics)가 읽는 features 형태로 Amazon 점수 breakdown 저장 */
export function withAmazonScoreFeatures(
  breakdown: ScoreBreakdown,
  priced: { salePriceKrw: number; costKrw: number },
  sourcePriceUsd: number,
  extras?: AmazonScoreFeatureExtras,
) {
  const marginRate =
    priced.salePriceKrw > 0
      ? (priced.salePriceKrw - priced.costKrw) / priced.salePriceKrw
      : 0;
  return {
    ...breakdown,
    features: {
      sellPriceKrw: priced.salePriceKrw,
      sourceCostKrw: priced.costKrw,
      sourcePriceUsd,
      marginRate,
      targetMarginRate: extras?.targetMarginRate ?? null,
      intlShippingKrw: extras?.intlShippingKrw ?? null,
      competitorAvgKrw: extras?.competitorAvgKrw ?? null,
      competitorSamples: extras?.competitorSamples ?? [],
      minViableSaleKrw: extras?.minViableSaleKrw ?? null,
      isFallback: Boolean(extras?.isFallback),
      naverKeyword: extras?.naverKeyword ?? null,
      shipping: extras?.shipping ?? null,
    },
    marketVerdict: extras?.marketVerdict ?? null,
  };
}
