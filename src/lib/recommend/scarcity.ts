/**
 * 희소성 점수·시장 유형 (규칙 기반, 가산 항목 투명).
 */

import {
  assessBrandAwareness,
  assessCoupangDensityProxy,
  assessReviewPressure,
  assessSearchMomentum,
  PRICE_WAR_KEYWORD_RE,
  SCARCITY_KEYWORD_RE,
} from "@/lib/discover/demand/market-signals";

export type MarketType = "PRICE_WAR" | "SCARCE" | "UNCLEAR";
export type LetterGrade = "A" | "B" | "C" | "D" | "E";

export type ScarcityRefLink = {
  label: string;
  href: string;
  description?: string;
};

export type ScarcityBreakdownItem = {
  key: string;
  label: string;
  points: number;
  /** 이 점수가 나온 판단 기준(임계값) 설명 */
  criteria: string;
  /** 부가 해석 */
  note?: string;
  refs?: ScarcityRefLink[];
};

export type ScarcityAssessment = {
  score: number;
  grade: LetterGrade;
  marketType: MarketType;
  marketTypeLabel: string;
  /** 시장 유형을 고른 이유 */
  marketTypeReason: string;
  strategy: string;
  breakdown: ScarcityBreakdownItem[];
  confidence: "low" | "medium" | "high";
  /** 전체 평가 방법·등급 기준 */
  methodology: string[];
  /** 원데이터 확인용 링크 */
  referenceLinks: ScarcityRefLink[];
  signals: {
    shopTotal: number | null;
    uniqueMallCount: number;
    priceDispersion: number | null;
    sameLikelyCount: number;
    brandScore: number;
    searchMomentum: number;
    reviewPressure: number;
    coupangDensity: number;
  };
};

export function letterFromScoreDesc(score: number): LetterGrade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  if (score >= 25) return "D";
  return "E";
}

export function naverShoppingSearchUrl(keyword: string): string {
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword.trim())}`;
}

export function coupangSearchUrl(keyword: string): string {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword.trim())}`;
}

/** (p75−p25)/median — 낮을수록 가격 군집(가격전쟁) */
export function priceDispersionRatio(prices: number[]): number | null {
  if (prices.length < 3) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo]!;
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
  };
  const med = q(0.5);
  if (med <= 0) return null;
  return (q(0.75) - q(0.25)) / med;
}

const METHODOLOGY = [
  "희소성 점수는 LLM이 아니라 규칙 가산합(0~100)입니다. 항목별 기준을 펼쳐 확인할 수 있습니다.",
  "등급: A≥80 · B≥65 · C≥45 · D≥25 · E<25. 가격경쟁(PRICE_WAR)이면 점수 상한 40.",
  "시장 유형 PRICE_WAR는 단일 지표가 아니라 신호 합≥3일 때만 확정합니다(등록 hit만으로 단정하지 않음).",
  "SCARCE: 희소 점수·낮은 등록·해외/한정 키워드. 그 외는 UNCLEAR(추가 검증).",
  "국내 등록 건수(shop.total)는 셀러 수가 아니라 네이버 쇼핑 검색 hit 수입니다.",
  "샘플 고유 몰·시세 분산은 관련도순 상위 샘플(최대 약 40건) 기준입니다.",
];

export function buildScarcityAssessment(input: {
  keyword?: string | null;
  title?: string | null;
  brand?: string | null;
  shopTotal?: number | null;
  uniqueMallCount?: number | null;
  prices?: number[] | null;
  sameLikelyCount?: number | null;
  searchVolume?: number | null;
  competition?: number | null;
  seasonalityScore?: number | null;
  reviewCount?: number | null;
}): ScarcityAssessment {
  const breakdown: ScarcityBreakdownItem[] = [];
  const shopTotal =
    input.shopTotal != null && Number.isFinite(input.shopTotal)
      ? Math.max(0, Math.round(input.shopTotal))
      : null;
  const uniqueMallCount = Math.max(0, input.uniqueMallCount ?? 0);
  const sameLikelyCount = Math.max(0, input.sameLikelyCount ?? 0);
  const prices = (input.prices ?? []).filter((p) => p > 0);
  const dispersion = priceDispersionRatio(prices);
  const keyword = (input.keyword ?? "").trim();
  const text = `${keyword} ${input.title ?? ""}`;
  const naverHref = keyword ? naverShoppingSearchUrl(keyword) : null;
  const coupangHref = keyword ? coupangSearchUrl(keyword) : null;
  const naverRef: ScarcityRefLink[] | undefined = naverHref
    ? [
        {
          label: "네이버 쇼핑 검색",
          href: naverHref,
          description: "등록 건수·시세 샘플의 원천 검색",
        },
      ]
    : undefined;

  const brand = assessBrandAwareness({
    brand: input.brand,
    title: input.title,
    keyword: input.keyword,
  });
  const momentum = assessSearchMomentum({
    searchVolume: input.searchVolume,
    competition: input.competition,
    seasonalityScore: input.seasonalityScore,
  });
  const reviewPressure = assessReviewPressure({
    shopTotal,
    uniqueMallCount,
    reviewCount: input.reviewCount,
  });
  const coupang = assessCoupangDensityProxy({
    keyword: input.keyword,
    title: input.title,
  });

  // --- 가산 (희소 ↑) ---
  const densityCriteria =
    "네이버 쇼핑 검색 total: <50→+30 · <200→+22 · <1000→+12 · <5000→+5 · ≥5000→+0(과열). hit 수≠셀러 수.";
  if (shopTotal == null) {
    breakdown.push({
      key: "density",
      label: "등록 밀도 불명(부분 점수)",
      points: 8,
      criteria: densityCriteria,
      note: "API 미응답·키 없음 등으로 shop.total을 못 받았을 때 부분 점수.",
      refs: naverRef,
    });
  } else if (shopTotal < 50) {
    breakdown.push({
      key: "density",
      label: `국내 등록 ${shopTotal}건 (매우 적음)`,
      points: 30,
      criteria: densityCriteria,
      refs: naverRef,
    });
  } else if (shopTotal < 200) {
    breakdown.push({
      key: "density",
      label: `국내 등록 ${shopTotal}건 (적음)`,
      points: 22,
      criteria: densityCriteria,
      refs: naverRef,
    });
  } else if (shopTotal < 1000) {
    breakdown.push({
      key: "density",
      label: `국내 등록 ${shopTotal.toLocaleString("ko-KR")}건`,
      points: 12,
      criteria: densityCriteria,
      refs: naverRef,
    });
  } else if (shopTotal < 5000) {
    breakdown.push({
      key: "density",
      label: `국내 등록 ${shopTotal.toLocaleString("ko-KR")}건 (많음)`,
      points: 5,
      criteria: densityCriteria,
      refs: naverRef,
    });
  } else {
    breakdown.push({
      key: "density",
      label: `국내 등록 ${shopTotal.toLocaleString("ko-KR")}건 (과열)`,
      points: 0,
      criteria: densityCriteria,
      note: "검색 hit가 매우 많아 희소성 가산 없음. 가격경쟁 시장 신호.",
      refs: naverRef,
    });
  }

  let mallPts = 0;
  if (uniqueMallCount <= 0) {
    mallPts = 5;
  } else if (uniqueMallCount <= 2) {
    mallPts = 25;
  } else if (uniqueMallCount <= 5) {
    mallPts = 18;
  } else if (uniqueMallCount <= 10) {
    mallPts = 10;
  } else {
    mallPts = 0;
  }
  breakdown.push({
    key: "malls",
    label: `샘플 고유 몰 ${uniqueMallCount || "?"}곳`,
    points: mallPts,
    criteria:
      "관련도순 상위 샘플의 고유 mallName 수: ≤2→+25 · ≤5→+18 · ≤10→+10 · ≥11→+0. 전수 셀러 수가 아님.",
    note: "샘플 범위 안에서의 판매처 다양성입니다.",
    refs: naverRef,
  });

  const dispersionCriteria =
    "시세 분산 = (P75−P25)/중앙값. ≥0.45→+15(분산 큼) · 0.18~0.45→+8 · ≤0.18→+0(군집=가격전쟁).";
  if (dispersion == null) {
    breakdown.push({
      key: "dispersion",
      label: "시세 분산 데이터 부족",
      points: 5,
      criteria: dispersionCriteria,
      note: "유효 가격 샘플 3개 미만.",
      refs: naverRef,
    });
  } else if (dispersion >= 0.45) {
    breakdown.push({
      key: "dispersion",
      label: `시세 분산 큼(${dispersion.toFixed(2)}) — 대체품 약함`,
      points: 15,
      criteria: dispersionCriteria,
      refs: naverRef,
    });
  } else if (dispersion <= 0.18) {
    breakdown.push({
      key: "dispersion",
      label: `시세 군집(${dispersion.toFixed(2)}) — 가격경쟁`,
      points: 0,
      criteria: dispersionCriteria,
      note: "가격대가 좁게 모여 최저가 경쟁 가능성이 큽니다.",
      refs: naverRef,
    });
  } else {
    breakdown.push({
      key: "dispersion",
      label: `시세 분산 보통(${dispersion.toFixed(2)})`,
      points: 8,
      criteria: dispersionCriteria,
      refs: naverRef,
    });
  }

  let reviewPts = 0;
  if (reviewPressure.score <= 15) {
    reviewPts = 20;
  } else if (reviewPressure.score <= 35) {
    reviewPts = 12;
  } else if (reviewPressure.score >= 55) {
    reviewPts = 0;
  } else {
    reviewPts = 6;
  }
  breakdown.push({
    key: "reviews",
    label: `리뷰·노출 압력 · ${reviewPressure.label}`,
    points: reviewPts,
    criteria:
      "리뷰 실측이 없으면 등록 밀도·몰 수로 압력 추정. 압력점수 ≤15→+20 · ≤35→+12 · <55→+6 · ≥55→+0.",
    note: reviewPressure.reasons.slice(0, 2).join(" · ") || undefined,
    refs: naverRef,
  });

  const brandPts = Math.min(20, Math.round(brand.score * 0.4));
  breakdown.push({
    key: "brand",
    label: brand.label,
    points: brandPts,
    criteria:
      "브랜드 문자열·라틴(해외) 브랜드·한정/해외전용 키워드로 0~100 산출 후 ×0.4(최대 +20).",
    note: brand.reasons.slice(0, 2).join(" · ") || undefined,
  });

  if (SCARCITY_KEYWORD_RE.test(text)) {
    breakdown.push({
      key: "keyword_scarce",
      label: "한정·해외전용·신상 키워드",
      points: 15,
      criteria:
        "키워드/제목에 한정·exclusive·코스트코·굿즈·DIY·캠핑·신상 등 희소 패턴 매칭 시 +15.",
    });
  } else if (PRICE_WAR_KEYWORD_RE.test(text)) {
    breakdown.push({
      key: "keyword_war",
      label: "범용 가격경쟁 키워드",
      points: 0,
      criteria:
        "이어폰·텀블러·케이스·LED·보조배터리 등 범용 카테고리 매칭 시 희소 가산 0 + 시장유형 PRICE_WAR 후보.",
    });
  }

  const momentumPts = Math.min(10, Math.round(momentum.score * 0.12));
  breakdown.push({
    key: "momentum",
    label: `수요 모멘텀 · ${momentum.label}`,
    points: momentumPts,
    criteria:
      "검색량·경쟁도·시즌성으로 모멘텀 0~100 → ×0.12(최대 +10). 검색↑·경쟁↓일수록 가산.",
    note: momentum.reasons.slice(0, 2).join(" · ") || undefined,
  });

  if (coupang.estimatedSellerBand === "many") {
    breakdown.push({
      key: "coupang",
      label: coupang.label,
      points: -10,
      criteria:
        "쿠팡 실셀러 API 전 단계: 범용 가격경쟁 키워드면 과열(−10), 한정·해외면 희소(+8).",
      note: coupang.reasons[0],
      refs: coupangHref
        ? [
            {
              label: "쿠팡 검색(참고)",
              href: coupangHref,
              description: "휴리스틱 검증용 — 실셀러 수 아님",
            },
          ]
        : undefined,
    });
  } else if (coupang.estimatedSellerBand === "few") {
    breakdown.push({
      key: "coupang",
      label: coupang.label,
      points: 8,
      criteria:
        "쿠팡 실셀러 API 전 단계: 범용 가격경쟁 키워드면 과열(−10), 한정·해외면 희소(+8).",
      note: coupang.reasons[0],
      refs: coupangHref
        ? [
            {
              label: "쿠팡 검색(참고)",
              href: coupangHref,
              description: "휴리스틱 검증용 — 실셀러 수 아님",
            },
          ]
        : undefined,
    });
  }

  if (sameLikelyCount >= 8) {
    breakdown.push({
      key: "same_likely",
      label: `동일 추정 상품 ${sameLikelyCount}건 — 대체 용이`,
      points: -8,
      criteria:
        "브랜드·모델 토큰이 겹치는 ‘동일 추정’ 샘플 ≥8이면 −8 (대체품이 많아 희소↓).",
      refs: naverRef,
    });
  }

  let score = breakdown.reduce((s, b) => s + b.points, 0);
  score = Math.min(100, Math.max(0, score));

  // shop.total은 hit 수라 대부분 키워드가 수천~수십만 → 단독으로 PRICE_WAR 금지
  const tightCluster =
    dispersion != null && dispersion <= 0.18 && prices.length >= 5;
  const warKeyword = PRICE_WAR_KEYWORD_RE.test(text);
  const scarceKeyword = SCARCITY_KEYWORD_RE.test(text);

  const warSignals: string[] = [];
  let warScore = 0;
  if (warKeyword) {
    warScore += 2;
    warSignals.push("범용 가격경쟁 키워드(+2)");
  }
  if (shopTotal != null && shopTotal >= 80_000) {
    warScore += 2;
    warSignals.push(
      `등록 ${shopTotal.toLocaleString("ko-KR")}건 ≥ 8만(+2)`,
    );
  } else if (shopTotal != null && shopTotal >= 20_000) {
    warScore += 1;
    warSignals.push(
      `등록 ${shopTotal.toLocaleString("ko-KR")}건 ≥ 2만(+1)`,
    );
  }
  if (uniqueMallCount >= 12 && tightCluster) {
    warScore += 2;
    warSignals.push("고유 몰≥12 + 시세 군집(+2)");
  } else if (uniqueMallCount >= 8 && tightCluster) {
    warScore += 1;
    warSignals.push("고유 몰≥8 + 시세 군집(+1)");
  }
  if (
    input.competition != null &&
    input.competition >= 0.85 &&
    (shopTotal ?? 0) >= 10_000
  ) {
    warScore += 1;
    warSignals.push(
      `경쟁도 ${input.competition.toFixed(2)} + 등록≥1만(+1)`,
    );
  }
  if (coupang.estimatedSellerBand === "many") {
    warScore += 1;
    warSignals.push("쿠팡 과열 추정(+1)");
  }

  let marketType: MarketType = "UNCLEAR";
  let marketTypeReason =
    "신호 부족 — 등록 hit만으로는 가격경쟁/희소를 단정하지 않습니다.";

  // 희소 신호를 먼저 볼 여지: 한정·해외 키워드 + 낮은 등록이면 SCARCE 우선
  const scarceCandidate =
    (score >= 55 && (shopTotal == null || shopTotal < 3_000)) ||
    (scarceKeyword &&
      score >= 40 &&
      (shopTotal == null || shopTotal < 15_000)) ||
    (shopTotal != null &&
      shopTotal < 200 &&
      uniqueMallCount <= 5 &&
      score >= 35);

  if (scarceCandidate && warScore < 3) {
    marketType = "SCARCE";
    marketTypeReason =
      "SCARCE: 희소 점수·등록 규모·해외/한정 키워드 조건 충족 (가격경쟁 신호 합 < 3).";
  } else if (warScore >= 3) {
    marketType = "PRICE_WAR";
    marketTypeReason = `PRICE_WAR: 신호 합 ${warScore}≥3 · ${warSignals.join(" · ")}`;
  } else if (scarceCandidate) {
    marketType = "SCARCE";
    marketTypeReason =
      "SCARCE: 희소 조건 충족 (가격경쟁 신호와 경합했으나 희소 우선).";
  } else {
    marketTypeReason = `UNCLEAR: 가격경쟁 신호 합 ${warScore}/3 · ${
      warSignals.length > 0 ? warSignals.join(" · ") : "특이 신호 없음"
    }. Amazon 원가·대체품을 추가 확인하세요.`;
  }

  if (marketType === "PRICE_WAR") {
    score = Math.min(score, 40);
  }

  const grade = letterFromScoreDesc(score);

  let marketTypeLabel = "판단 보류";
  let strategy = "데이터 부족 — Amazon 원가·시세를 더 확인하세요.";
  if (marketType === "PRICE_WAR") {
    marketTypeLabel = "가격 경쟁 시장";
    strategy =
      "가격 경쟁 심함 — 추천 마진 5~10%, 광고비 부담, 판매 비추천에 가깝습니다.";
  } else if (marketType === "SCARCE") {
    marketTypeLabel = "희소성 시장";
    strategy =
      "희소성 높음 — 평균보다 20~40% 높은 가격 책정·마진 확보가 가능합니다.";
  } else {
    strategy = "시장 유형 불명확 — 대체품·셀러 수를 추가 검증하세요.";
  }

  let confidence: "low" | "medium" | "high" = "medium";
  if (shopTotal == null && prices.length < 3) confidence = "low";
  else if (shopTotal != null && prices.length >= 5) confidence = "high";

  const referenceLinks: ScarcityRefLink[] = [];
  if (naverHref) {
    referenceLinks.push({
      label: "네이버 쇼핑에서 검증",
      href: naverHref,
      description: `키워드 「${keyword}」 등록·시세 원천`,
    });
  }
  if (coupangHref) {
    referenceLinks.push({
      label: "쿠팡에서 참고 검색",
      href: coupangHref,
      description: "셀러 밀도 휴리스틱 교차 확인(실수 아님)",
    });
  }

  return {
    score,
    grade,
    marketType,
    marketTypeLabel,
    marketTypeReason,
    strategy,
    breakdown,
    confidence,
    methodology: METHODOLOGY,
    referenceLinks,
    signals: {
      shopTotal,
      uniqueMallCount,
      priceDispersion: dispersion,
      sameLikelyCount,
      brandScore: brand.score,
      searchMomentum: momentum.score,
      reviewPressure: reviewPressure.score,
      coupangDensity: coupang.density,
    },
  };
}
