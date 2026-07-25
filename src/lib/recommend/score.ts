export type ScoreInput = {
  title: string;
  brand?: string | null;
  sourcePriceUsd: number;
  salePriceKrw: number;
  costKrw: number;
  inStock: boolean;
  imageCount: number;
  alreadyListed: boolean;
  recentSales?: number;
};

export type ScoreBreakdown = {
  total: number;
  marginScore: number;
  priceBandScore: number;
  stockScore: number;
  brandScore: number;
  imageScore: number;
  listingPenalty: number;
  salesBoost: number;
  reasons: string[];
};

/**
 * 규칙 기반 추천 점수 (0–100). GPT는 점수 결정에 사용하지 않음.
 */
export function scoreCandidate(input: ScoreInput): ScoreBreakdown {
  const reasons: string[] = [];
  const margin =
    input.salePriceKrw > 0
      ? (input.salePriceKrw - input.costKrw) / input.salePriceKrw
      : 0;

  let marginScore = 0;
  if (margin >= 0.35) {
    marginScore = 35;
    reasons.push("고마진(35%+)");
  } else if (margin >= 0.25) {
    marginScore = 28;
    reasons.push("양호한 마진(25%+)");
  } else if (margin >= 0.15) {
    marginScore = 18;
    reasons.push("보통 마진");
  } else {
    marginScore = 8;
    reasons.push("마진 낮음");
  }

  let priceBandScore = 0;
  if (input.sourcePriceUsd >= 15 && input.sourcePriceUsd <= 80) {
    priceBandScore = 25;
    reasons.push("소싱가 스위트스팟($15–80)");
  } else if (input.sourcePriceUsd >= 8 && input.sourcePriceUsd < 15) {
    priceBandScore = 18;
    reasons.push("저가 대역");
  } else if (input.sourcePriceUsd > 80 && input.sourcePriceUsd <= 150) {
    priceBandScore = 14;
    reasons.push("중고가 대역");
  } else {
    priceBandScore = 6;
    reasons.push("가격대 비선호");
  }

  const stockScore = input.inStock ? 15 : 0;
  if (input.inStock) reasons.push("재고 있음");
  else reasons.push("품절");

  const brandScore = input.brand?.trim() ? 10 : 3;
  if (input.brand?.trim()) reasons.push("브랜드 확인");

  let imageScore = 0;
  if (input.imageCount >= 3) {
    imageScore = 10;
    reasons.push("이미지 충분");
  } else if (input.imageCount >= 1) {
    imageScore = 6;
  } else {
    imageScore = 0;
    reasons.push("이미지 부족");
  }

  const listingPenalty = input.alreadyListed ? -20 : 0;
  if (input.alreadyListed) reasons.push("이미 리스팅됨(감점)");

  const sales = input.recentSales ?? 0;
  const salesBoost = Math.min(10, sales * 2);
  if (sales > 0) reasons.push(`최근 판매 ${sales}건`);

  const total = Math.max(
    0,
    Math.min(
      100,
      marginScore +
        priceBandScore +
        stockScore +
        brandScore +
        imageScore +
        listingPenalty +
        salesBoost,
    ),
  );

  return {
    total,
    marginScore,
    priceBandScore,
    stockScore,
    brandScore,
    imageScore,
    listingPenalty,
    salesBoost,
    reasons,
  };
}

export function reasonCodeFromScore(total: number): string {
  if (total >= 75) return "STRONG_BUY";
  if (total >= 55) return "BUY";
  if (total >= 40) return "WATCH";
  return "SKIP";
}
