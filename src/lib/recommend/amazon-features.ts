import type { MarketVerdict } from "@/lib/pricing/viability";
import type { ScoreBreakdown } from "@/lib/recommend/score";

export type AmazonScoreFeatureExtras = {
  intlShippingKrw?: number | null;
  competitorAvgKrw?: number | null;
  minViableSaleKrw?: number | null;
  marketVerdict?: MarketVerdict | null;
  isFallback?: boolean;
  naverKeyword?: string | null;
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
      intlShippingKrw: extras?.intlShippingKrw ?? null,
      competitorAvgKrw: extras?.competitorAvgKrw ?? null,
      minViableSaleKrw: extras?.minViableSaleKrw ?? null,
      isFallback: Boolean(extras?.isFallback),
      naverKeyword: extras?.naverKeyword ?? null,
    },
    marketVerdict: extras?.marketVerdict ?? null,
  };
}
