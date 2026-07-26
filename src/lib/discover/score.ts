import type { MarketVerdictCode } from "@/lib/pricing/viability";

export type DiscoverScoreInput = {
  searchVolume: number;
  competition: number; // 0–1
  marginRate: number; // 0–1
  rating: number; // 0–5
  reviewCount: number;
  seasonalityScore: number; // 0–100
  /** 시장성 판정 — 점수 가감 + NOT_RECOMMENDED 시 PASS 강등 */
  marketVerdictCode?: MarketVerdictCode | null;
};

export type DiscoverScoreBreakdown = {
  total: number;
  volumeScore: number;
  competitionScore: number;
  marginScore: number;
  ratingScore: number;
  reviewScore: number;
  seasonalityScore: number;
  /** 시장성 가감 (−25 ~ +15) */
  marketScore: number;
  marketVerdictCode: MarketVerdictCode | null;
  reasons: string[];
  label: DiscoverLabel;
};

export type DiscoverLabel = "STRONG_BUY" | "BUY" | "WATCH" | "PASS";

/**
 * 네이버↔1688 발굴용 규칙 점수 (0–100). GPT는 점수에 관여하지 않음.
 */
export function scoreDiscoverCandidate(
  input: DiscoverScoreInput,
): DiscoverScoreBreakdown {
  const reasons: string[] = [];

  let volumeScore = 0;
  if (input.searchVolume >= 20000) {
    volumeScore = 25;
    reasons.push("검색량 높음(2만+)");
  } else if (input.searchVolume >= 8000) {
    volumeScore = 20;
    reasons.push("검색량 양호(8천+)");
  } else if (input.searchVolume >= 2000) {
    volumeScore = 14;
    reasons.push("검색량 보통");
  } else if (input.searchVolume >= 500) {
    volumeScore = 8;
    reasons.push("검색량 낮음");
  } else {
    volumeScore = 3;
    reasons.push("검색량 매우 낮음");
  }

  let competitionScore = 0;
  if (input.competition <= 0.25) {
    competitionScore = 20;
    reasons.push("경쟁 낮음");
  } else if (input.competition <= 0.45) {
    competitionScore = 15;
    reasons.push("경쟁 보통");
  } else if (input.competition <= 0.65) {
    competitionScore = 9;
    reasons.push("경쟁 다소 높음");
  } else {
    competitionScore = 3;
    reasons.push("경쟁 과열");
  }

  let marginScore = 0;
  if (input.marginRate >= 0.4) {
    marginScore = 25;
    reasons.push("고마진(40%+)");
  } else if (input.marginRate >= 0.3) {
    marginScore = 20;
    reasons.push("양호 마진(30%+)");
  } else if (input.marginRate >= 0.2) {
    marginScore = 12;
    reasons.push("보통 마진");
  } else if (input.marginRate >= 0.1) {
    marginScore = 6;
    reasons.push("마진 낮음");
  } else {
    marginScore = 2;
    reasons.push("마진 부족");
  }

  let ratingScore = 0;
  if (input.rating >= 4.5) {
    ratingScore = 12;
    reasons.push("평점 우수");
  } else if (input.rating >= 4.0) {
    ratingScore = 9;
    reasons.push("평점 양호");
  } else if (input.rating >= 3.5) {
    ratingScore = 5;
  } else {
    ratingScore = 2;
    reasons.push("평점 낮음");
  }

  let reviewScore = 0;
  if (input.reviewCount >= 5000) {
    reviewScore = 10;
    reasons.push("리뷰 다수(수요 검증)");
  } else if (input.reviewCount >= 1000) {
    reviewScore = 8;
  } else if (input.reviewCount >= 200) {
    reviewScore = 5;
  } else if (input.reviewCount >= 50) {
    reviewScore = 3;
  } else {
    reviewScore = 1;
    reasons.push("리뷰 부족");
  }

  let seasonalityPart = 0;
  if (input.seasonalityScore >= 70) {
    seasonalityPart = 8;
    reasons.push("시즌성 유리");
  } else if (input.seasonalityScore >= 40) {
    seasonalityPart = 5;
  } else {
    seasonalityPart = 2;
    reasons.push("시즌성 불리");
  }

  const marketVerdictCode = input.marketVerdictCode ?? null;
  let marketScore = 0;
  if (marketVerdictCode === "SELL") {
    marketScore = 15;
    reasons.push("시장성 양호(판매 가능)");
  } else if (marketVerdictCode === "NEED_CONSOLIDATION") {
    marketScore = 5;
    reasons.push("합배송 시 시장성");
  } else if (marketVerdictCode === "NOT_RECOMMENDED") {
    marketScore = -25;
    reasons.push("시장성 낮음(경쟁 대비 고가)");
  } else if (marketVerdictCode === "NO_MARKET_DATA") {
    marketScore = 0;
    reasons.push("경쟁가 없어 시장성 미판정");
  }

  const total = Math.max(
    0,
    Math.min(
      100,
      volumeScore +
        competitionScore +
        marginScore +
        ratingScore +
        reviewScore +
        seasonalityPart +
        marketScore,
    ),
  );

  let label = discoverLabelFromScore(total);
  if (marketVerdictCode === "NOT_RECOMMENDED" && label !== "PASS") {
    label = "PASS";
    reasons.push("시장성으로 PASS 강등");
  }

  return {
    total,
    volumeScore,
    competitionScore,
    marginScore,
    ratingScore,
    reviewScore,
    seasonalityScore: seasonalityPart,
    marketScore,
    marketVerdictCode,
    reasons,
    label,
  };
}

export function discoverLabelFromScore(total: number): DiscoverLabel {
  if (total >= 75) return "STRONG_BUY";
  if (total >= 55) return "BUY";
  if (total >= 40) return "WATCH";
  return "PASS";
}
