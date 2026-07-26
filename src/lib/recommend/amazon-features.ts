import type { ScoreBreakdown } from "@/lib/recommend/score";

/** UI(RecommendEconomics)가 읽는 features 형태로 Amazon 점수 breakdown 저장 */
export function withAmazonScoreFeatures(
  breakdown: ScoreBreakdown,
  priced: { salePriceKrw: number; costKrw: number },
  sourcePriceUsd: number,
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
    },
  };
}
