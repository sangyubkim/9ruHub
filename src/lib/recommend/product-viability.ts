/**
 * 상품성 평가 카드 — 가격 계산기 위의 상위 산출물.
 */

import type { AmazonShipEligibility } from "@/lib/amazon/ship-eligibility";
import { assessCsRisk, type CsRiskLevel } from "@/lib/recommend/cs-risk";
import type { DecisionGuide } from "@/lib/recommend/decision-guide";
import {
  buildScarcityAssessment,
  letterFromScoreDesc,
  type LetterGrade,
  type MarketType,
  type ScarcityAssessment,
} from "@/lib/recommend/scarcity";
import {
  buildSourcingFit,
  type SourcingFit,
} from "@/lib/recommend/sourcing-fit";
import type { MarketVerdictCode } from "@/lib/pricing/viability";

export type ProductViability = {
  marketType: MarketType;
  marketTypeLabel: string;
  /** 시장 유형 판정 근거 */
  marketTypeReason: string;
  strategy: string;
  priceCompetitiveness: LetterGrade;
  priceCompetitivenessLabel: string;
  scarcity: LetterGrade;
  scarcityScore: number;
  scarcityLabel: string;
  csRisk: CsRiskLevel;
  csRiskLabel: string;
  csRiskReasons: string[];
  expectedProfitKrw: number | null;
  saleLowKrw: number | null;
  saleHighKrw: number | null;
  recommendedSaleKrw: number | null;
  recommendStars: number;
  recommendLabel: string;
  confidence: "low" | "medium" | "high";
  scarcityBreakdown: ScarcityAssessment["breakdown"];
  methodology: string[];
  referenceLinks: ScarcityAssessment["referenceLinks"];
  summary: string;
  /** US 포워더 / KR 직배송 적합성 */
  sourcingFit?: SourcingFit | null;
  shipEligibility?: AmazonShipEligibility | null;
};

function priceCompetitivenessGrade(input: {
  landedOrMinViableKrw?: number | null;
  competitorAvgKrw?: number | null;
  marketVerdictCode?: MarketVerdictCode | null;
  marketType: MarketType;
  expectedProfitKrw?: number | null;
}): { grade: LetterGrade; label: string } {
  const minV = input.landedOrMinViableKrw;
  const comp = input.competitorAvgKrw;

  if (input.marketVerdictCode === "NOT_RECOMMENDED") {
    return { grade: "E", label: "시세 대비 불가" };
  }
  if (comp == null || minV == null || comp <= 0) {
    if (input.marketType === "SCARCE" && (input.expectedProfitKrw ?? 0) > 0) {
      return { grade: "B", label: "시세 없음·희소 마진 가능" };
    }
    return { grade: "C", label: "시세 데이터 부족" };
  }

  const ratio = minV / comp;
  if (ratio <= 0.75 && (input.expectedProfitKrw ?? 0) > 0) {
    return { grade: "A", label: "원가 우위" };
  }
  if (ratio <= 0.9) {
    return { grade: "B", label: "가격 경쟁 가능" };
  }
  if (ratio <= 1.05) {
    return { grade: "C", label: "시세 근접" };
  }
  if (ratio <= 1.2) {
    return { grade: "D", label: "시세보다 비쌈" };
  }
  return { grade: "E", label: "가격 경쟁 불리" };
}

function starsFromAxes(input: {
  marketType: MarketType;
  scarcityScore: number;
  priceGrade: LetterGrade;
  csRisk: CsRiskLevel;
  expectedProfitKrw: number | null;
}): { stars: number; label: string } {
  const priceMap: Record<LetterGrade, number> = {
    A: 5,
    B: 4,
    C: 3,
    D: 2,
    E: 1,
  };
  let stars = Math.round(
    (input.scarcityScore / 100) * 2.5 + priceMap[input.priceGrade] * 0.5,
  );

  if (input.marketType === "PRICE_WAR") {
    stars = Math.min(stars, 2);
  } else if (input.marketType === "SCARCE") {
    stars = Math.max(stars, 3);
    if (input.scarcityScore >= 70 && (input.expectedProfitKrw ?? 0) > 0) {
      stars = Math.max(stars, 4);
    }
  }

  if (input.csRisk === "high") stars = Math.min(stars, 3);
  if (input.expectedProfitKrw != null && input.expectedProfitKrw < 0) {
    stars = Math.min(stars, 1);
  }

  stars = Math.min(5, Math.max(1, stars));

  const label =
    stars >= 5
      ? "강력 추천"
      : stars >= 4
        ? "판매 추천"
        : stars >= 3
          ? "조건부 검토"
          : stars >= 2
            ? "비추천에 가까움"
            : "판매 비추천";

  return { stars, label };
}

export function buildProductViability(input: {
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
  weightGrams?: number | null;
  categoryHints?: string[] | null;
  competitorAvgKrw?: number | null;
  marketVerdictCode?: MarketVerdictCode | null;
  decisionGuide?: DecisionGuide | null;
  minViableSaleKrw?: number | null;
  /** Amazon URL 대기 — 비추천 라벨 완화 */
  awaitingSupply?: boolean;
  shipEligibility?: AmazonShipEligibility | null;
}): ProductViability {
  const scarcity = buildScarcityAssessment({
    keyword: input.keyword,
    title: input.title,
    brand: input.brand,
    shopTotal: input.shopTotal,
    uniqueMallCount: input.uniqueMallCount,
    prices: input.prices,
    sameLikelyCount: input.sameLikelyCount,
    searchVolume: input.searchVolume,
    competition: input.competition,
    seasonalityScore: input.seasonalityScore,
    reviewCount: input.reviewCount,
  });

  const cs = assessCsRisk({
    title: input.title,
    keyword: input.keyword,
    brand: input.brand,
    categoryHints: input.categoryHints,
    weightGrams: input.weightGrams,
  });

  const guide = input.decisionGuide ?? null;
  const minViable =
    guide?.minViableSaleKrw ?? input.minViableSaleKrw ?? null;
  const price = priceCompetitivenessGrade({
    landedOrMinViableKrw: minViable,
    competitorAvgKrw: input.competitorAvgKrw ?? guide?.competitorAvgKrw,
    marketVerdictCode: input.marketVerdictCode,
    marketType: scarcity.marketType,
    expectedProfitKrw: guide?.expectedProfitKrw ?? null,
  });

  const awaitingSupply = input.awaitingSupply === true;
  const sourcingFit = buildSourcingFit({
    ship: input.shipEligibility,
    marketType: scarcity.marketType,
    shopTotal: input.shopTotal,
    scarcityScore: scarcity.score,
  });

  let { stars, label: recommendLabel } = starsFromAxes({
    marketType: scarcity.marketType,
    scarcityScore: scarcity.score,
    priceGrade: price.grade,
    csRisk: cs.level,
    expectedProfitKrw: guide?.expectedProfitKrw ?? null,
  });

  // 배송 적합성은 약하게만 가감 (하드 제외 없음)
  if (!awaitingSupply && sourcingFit.recommendBoost !== 0) {
    stars = Math.min(5, Math.max(1, stars + sourcingFit.recommendBoost));
    if (sourcingFit.code === "PROXY_BUY_STRONG" && stars >= 4) {
      recommendLabel = "구매대행 우선 검토";
    } else if (sourcingFit.code === "DIRECT_SHIP_RISK" && stars <= 3) {
      recommendLabel = "직배송 경쟁 주의";
    } else if (sourcingFit.code === "US_FAIL") {
      recommendLabel = "US 수령 불리·재확인";
    }
  }

  // Amazon URL 전: 최종 판매 비추천으로 단정하지 않음
  if (awaitingSupply && stars <= 2) {
    recommendLabel =
      scarcity.marketType === "PRICE_WAR"
        ? "공급 확인 전·가격경쟁(우선순위 낮음)"
        : "공급 확인 전·우선순위 낮음";
  }

  const strategy = awaitingSupply
    ? `${scarcity.strategy} (최종 판정은 Amazon URL·원가 확인 후)`
    : sourcingFit.code !== "UNCLEAR"
      ? `${scarcity.strategy} · ${sourcingFit.label}`
      : scarcity.strategy;

  const summary = [
    scarcity.marketTypeLabel,
    `희소성 ${scarcity.grade}(${scarcity.score}점)`,
    `가격경쟁력 ${price.grade}`,
    `CS ${cs.label}`,
    sourcingFit.label,
    strategy,
  ].join(" · ");

  return {
    marketType: scarcity.marketType,
    marketTypeLabel: scarcity.marketTypeLabel,
    marketTypeReason: scarcity.marketTypeReason,
    strategy,
    priceCompetitiveness: price.grade,
    priceCompetitivenessLabel: price.label,
    scarcity: scarcity.grade,
    scarcityScore: scarcity.score,
    scarcityLabel: `희소성 ${scarcity.grade}`,
    csRisk: cs.level,
    csRiskLabel: cs.label,
    csRiskReasons: cs.reasons,
    expectedProfitKrw: guide?.expectedProfitKrw ?? null,
    saleLowKrw: guide?.saleLowKrw ?? null,
    saleHighKrw: guide?.saleHighKrw ?? null,
    recommendedSaleKrw: guide?.recommendedSaleKrw ?? null,
    recommendStars: stars,
    recommendLabel,
    confidence: scarcity.confidence,
    scarcityBreakdown: scarcity.breakdown,
    methodology: scarcity.methodology,
    referenceLinks: scarcity.referenceLinks,
    summary,
    sourcingFit,
    shipEligibility: input.shipEligibility ?? null,
  };
}

export { letterFromScoreDesc };
