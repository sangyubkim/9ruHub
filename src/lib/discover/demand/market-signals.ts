/**
 * Phase D 시그널: 브랜드·검색 모멘텀·리뷰 압력·쿠팡 밀도 proxy.
 * 실측 API가 없는 항목은 설명 가능한 휴리스틱으로만 채운다.
 */

/** 국내 가격경쟁이 심한 키워드 (구매대행 비추천 후보) */
export const PRICE_WAR_KEYWORD_RE =
  /이어폰|이어버드|earbuds?|텀블러|tumbler|휴대폰\s*케이스|폰케이스|phone\s*case|led\s*조명|led\s*등|보조배터리|power\s*bank|마우스|keyboard|키보드|충전기|cable|케이블|마스크|양말|슬리퍼/i;

/** 해외/희소 힌트 */
export const SCARCITY_KEYWORD_RE =
  /한정|exclusive|costco|코스트코|굿즈|goods|diy|캠핑|camping|pets?|브랜드\s*전용|amazon\s*only|일본\s*한정|미국\s*전용|신상|new\s*arrival/i;

export type BrandAwarenessSignal = {
  score: number;
  label: string;
  isOverseasBrand: boolean;
  reasons: string[];
};

export type SearchMomentumSignal = {
  score: number;
  label: string;
  reasons: string[];
};

export type ReviewPressureSignal = {
  /** 높을수록 국내 리뷰·노출 경쟁이 셈 (희소성↓) */
  score: number;
  label: string;
  reasons: string[];
};

export type CoupangDensitySignal = {
  /** 0=희소 추정, 1=과열 추정. stub proxy */
  density: number;
  estimatedSellerBand: "few" | "moderate" | "many" | "unknown";
  label: string;
  reasons: string[];
  isStub: boolean;
};

export function assessBrandAwareness(input: {
  brand?: string | null;
  title?: string | null;
  keyword?: string | null;
}): BrandAwarenessSignal {
  const brand = (input.brand ?? "").trim();
  const text = `${brand} ${input.title ?? ""} ${input.keyword ?? ""}`;
  const reasons: string[] = [];
  let score = 0;
  let isOverseasBrand = false;

  if (brand.length >= 2) {
    score += 10;
    reasons.push(`브랜드 표기 있음 (${brand})`);
    // 라틴 문자 브랜드 → 해외 브랜드 가능성
    if (/[A-Za-z]{2,}/.test(brand) && !/^(쿠팡|네이버|이마트|다이소)/i.test(brand)) {
      score += 20;
      isOverseasBrand = true;
      reasons.push("해외(라틴) 브랜드 추정");
    }
  }

  if (SCARCITY_KEYWORD_RE.test(text)) {
    score += 15;
    isOverseasBrand = true;
    reasons.push("한정·해외전용·희소 키워드");
  }

  if (PRICE_WAR_KEYWORD_RE.test(text)) {
    score = Math.max(0, score - 15);
    reasons.push("범용 가격경쟁 카테고리 — 브랜드 차별 약함");
  }

  score = Math.min(100, Math.max(0, score));
  const label =
    score >= 40 ? "해외·차별 브랜드 가능" : score >= 15 ? "브랜드 보통" : "브랜드 약함";

  return { score, label, isOverseasBrand, reasons };
}

export function assessSearchMomentum(input: {
  searchVolume?: number | null;
  competition?: number | null;
  seasonalityScore?: number | null;
}): SearchMomentumSignal {
  const vol = input.searchVolume ?? 0;
  const comp = input.competition ?? 0.5;
  const season = input.seasonalityScore ?? 55;
  const reasons: string[] = [];
  let score = 0;

  if (vol >= 10_000) {
    score += 35;
    reasons.push(`검색량 높음 (${vol.toLocaleString("ko-KR")})`);
  } else if (vol >= 2_000) {
    score += 22;
    reasons.push(`검색량 중간 (${vol.toLocaleString("ko-KR")})`);
  } else if (vol >= 500) {
    score += 12;
    reasons.push(`검색량 있음 (${vol.toLocaleString("ko-KR")})`);
  } else if (vol > 0) {
    score += 4;
    reasons.push("검색량 낮음");
  }

  // 검색은 있는데 경쟁이 낮으면 모멘텀(기회)
  if (vol >= 1000 && comp <= 0.35) {
    score += 25;
    reasons.push("검색 대비 경쟁 낮음 — 수요 기회");
  } else if (vol >= 1000 && comp >= 0.75) {
    score -= 10;
    reasons.push("검색·경쟁 모두 높음 — 과열 가능");
  }

  if (season >= 70) {
    score += 10;
    reasons.push("시즌성 상승 구간");
  }

  score = Math.min(100, Math.max(0, score));
  const label =
    score >= 50 ? "수요 모멘텀 양호" : score >= 25 ? "수요 보통" : "수요 약함";

  return { score, label, reasons };
}

/**
 * 네이버 쇼핑 API에 리뷰 수가 없어, 등록 밀도·샘플 몰 수로 리뷰·노출 압력을 추정.
 */
export function assessReviewPressure(input: {
  shopTotal?: number | null;
  uniqueMallCount?: number | null;
  reviewCount?: number | null;
}): ReviewPressureSignal {
  const reasons: string[] = [];
  let score = 0;
  const reviews = input.reviewCount ?? 0;
  const shopTotal = input.shopTotal ?? 0;
  const malls = input.uniqueMallCount ?? 0;

  if (reviews > 0) {
    if (reviews >= 500) {
      score += 40;
      reasons.push(`리뷰 ${reviews.toLocaleString("ko-KR")}개 — 검증된 시장`);
    } else if (reviews >= 50) {
      score += 20;
      reasons.push(`리뷰 ${reviews.toLocaleString("ko-KR")}개`);
    } else {
      score += 5;
      reasons.push(`리뷰 ${reviews}개 — 아직 적음(희소 가산 가능)`);
    }
  } else {
    reasons.push("리뷰 실측 없음 — 등록 밀도로 압력 추정");
  }

  if (shopTotal >= 5000) {
    score += 40;
    reasons.push(`쇼핑 등록 ${shopTotal.toLocaleString("ko-KR")}건 — 노출 과열`);
  } else if (shopTotal >= 1000) {
    score += 25;
    reasons.push(`쇼핑 등록 ${shopTotal.toLocaleString("ko-KR")}건`);
  } else if (shopTotal >= 200) {
    score += 12;
  } else if (shopTotal > 0 && shopTotal < 80) {
    score += 0;
    reasons.push("등록 적음 — 리뷰·노출 압력 낮음");
  }

  if (malls >= 12) {
    score += 15;
    reasons.push(`샘플 몰 ${malls}곳 — 다수 판매처`);
  }

  score = Math.min(100, score);
  const label =
    score >= 55 ? "리뷰·노출 압력 높음" : score >= 25 ? "보통" : "압력 낮음";

  return { score, label, reasons };
}

/**
 * 쿠팡 실API 전 단계: 키워드 휴리스틱으로 판매자 밀도 band만 제공.
 */
export function assessCoupangDensityProxy(input: {
  keyword?: string | null;
  title?: string | null;
}): CoupangDensitySignal {
  const text = `${input.keyword ?? ""} ${input.title ?? ""}`;
  const reasons: string[] = [
    "쿠팡 실셀러 수 API 미연동 — 키워드 휴리스틱(stub)",
  ];

  if (!text.trim()) {
    return {
      density: 0.5,
      estimatedSellerBand: "unknown",
      label: "쿠팡 밀도 불명",
      reasons,
      isStub: true,
    };
  }

  if (PRICE_WAR_KEYWORD_RE.test(text)) {
    reasons.push("범용 카테고리 — 쿠팡 다수 셀러 추정");
    return {
      density: 0.85,
      estimatedSellerBand: "many",
      label: "쿠팡 과열 추정",
      reasons,
      isStub: true,
    };
  }

  if (SCARCITY_KEYWORD_RE.test(text)) {
    reasons.push("한정·해외 키워드 — 쿠팡 셀러 적음 추정");
    return {
      density: 0.2,
      estimatedSellerBand: "few",
      label: "쿠팡 희소 추정",
      reasons,
      isStub: true,
    };
  }

  return {
    density: 0.5,
    estimatedSellerBand: "moderate",
    label: "쿠팡 보통 추정",
    reasons,
    isStub: true,
  };
}
