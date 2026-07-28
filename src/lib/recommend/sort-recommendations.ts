/**
 * 추천 목록: 상품성 추천도(★) 우선 정렬 + verdict 필터.
 */

export type RecommendVerdictFilter = "all" | "recommend" | "hold" | "reject";

export function readViabilitySortKeys(scoreBreakdown: unknown): {
  recommendStars: number;
  scarcityScore: number;
  sourcingFitScore: number;
} {
  if (!scoreBreakdown || typeof scoreBreakdown !== "object") {
    return { recommendStars: 0, scarcityScore: 0, sourcingFitScore: 0 };
  }
  const features = (scoreBreakdown as { features?: Record<string, unknown> })
    .features;
  const v = features?.productViability;
  if (!v || typeof v !== "object") {
    return { recommendStars: 0, scarcityScore: 0, sourcingFitScore: 0 };
  }
  const o = v as Record<string, unknown>;
  const recommendStars =
    typeof o.recommendStars === "number" && Number.isFinite(o.recommendStars)
      ? o.recommendStars
      : 0;
  const scarcityScore =
    typeof o.scarcityScore === "number" && Number.isFinite(o.scarcityScore)
      ? o.scarcityScore
      : 0;

  let sourcingFitScore = 0;
  const fit =
    (o.sourcingFit as { score?: unknown } | undefined) ??
    (features?.sourcingFit as { score?: unknown } | undefined);
  if (fit && typeof fit === "object" && typeof fit.score === "number") {
    sourcingFitScore = fit.score;
  }

  return { recommendStars, scarcityScore, sourcingFitScore };
}

export function verdictFromStars(stars: number): Exclude<RecommendVerdictFilter, "all"> {
  if (stars >= 4) return "recommend";
  if (stars >= 3) return "hold";
  return "reject";
}

export function parseVerdictFilter(
  raw: string | null | undefined,
): RecommendVerdictFilter {
  if (raw === "recommend" || raw === "hold" || raw === "reject") return raw;
  return "all";
}

export function sortRecommendationsByViability<
  T extends {
    score: number | { toNumber?: () => number } | string;
    createdAt: Date | string;
    scoreBreakdown: unknown;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ka = readViabilitySortKeys(a.scoreBreakdown);
    const kb = readViabilitySortKeys(b.scoreBreakdown);
    if (kb.recommendStars !== ka.recommendStars) {
      return kb.recommendStars - ka.recommendStars;
    }
    if (kb.scarcityScore !== ka.scarcityScore) {
      return kb.scarcityScore - ka.scarcityScore;
    }
    if (kb.sourcingFitScore !== ka.sourcingFitScore) {
      return kb.sourcingFitScore - ka.sourcingFitScore;
    }
    const sa = Number(a.score);
    const sb = Number(b.score);
    if (sb !== sa) return sb - sa;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });
}

export function filterRecommendationsByVerdict<
  T extends { scoreBreakdown: unknown },
>(items: T[], verdict: RecommendVerdictFilter): T[] {
  if (verdict === "all") return items;
  return items.filter((item) => {
    const { recommendStars } = readViabilitySortKeys(item.scoreBreakdown);
    return verdictFromStars(recommendStars) === verdict;
  });
}

/** 비추천(★≤2) 여부 — productViability가 있을 때만 일괄 삭제 대상 */
export function isNotRecommendedBreakdown(scoreBreakdown: unknown): boolean {
  if (!scoreBreakdown || typeof scoreBreakdown !== "object") return false;
  const features = (scoreBreakdown as { features?: Record<string, unknown> })
    .features;
  const v = features?.productViability;
  if (!v || typeof v !== "object") return false;
  const stars = (v as { recommendStars?: unknown }).recommendStars;
  return typeof stars === "number" && Number.isFinite(stars) && stars <= 2;
}
