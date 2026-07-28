/**
 * CS·통관 위험 휴리스틱 (카테고리·무게·키워드 기반).
 * NLP/실제 CS 로그 없이 설명 가능한 규칙만 사용.
 */

export type CsRiskLevel = "low" | "medium" | "high";

export type CsRiskAssessment = {
  level: CsRiskLevel;
  label: string;
  score: number;
  reasons: string[];
};

const HIGH_RISK_RE =
  /배터리|battery|리튬|lithium|식품|먹거리|과자|보충제|supplement|화장품|cosmetic|스킨케어|향수|perfume|의료|medicine|처방|액체|liquid|스프레이|spray|가스|가스캔|위험물|hazmat|유아식|분유/i;

const MEDIUM_RISK_RE =
  /전자|earbuds?|이어폰|헤드폰|스피커|충전기|어댑터|스마트워치|카메라|드론|전동|모터|공구|tool|대형|부피|가구|가구류|유리|glass|도자기|취급주의|fragile|애완|펫|pet|사료|의류|clothing|신발|shoes/i;

export function assessCsRisk(input: {
  title?: string | null;
  keyword?: string | null;
  brand?: string | null;
  categoryHints?: string[] | null;
  weightGrams?: number | null;
}): CsRiskAssessment {
  const text = [
    input.title,
    input.keyword,
    input.brand,
    ...(input.categoryHints ?? []),
  ]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ");

  const reasons: string[] = [];
  let score = 20;

  if (HIGH_RISK_RE.test(text)) {
    score += 45;
    reasons.push("식품·화장품·배터리 등 CS/통관 고위험 키워드");
  } else if (MEDIUM_RISK_RE.test(text)) {
    score += 25;
    reasons.push("전자·파손·의류 등 CS 주의 카테고리");
  }

  const weight = input.weightGrams ?? 0;
  if (weight >= 5000) {
    score += 25;
    reasons.push("무게 5kg 이상 — 배송·파손·반품 부담");
  } else if (weight >= 2000) {
    score += 12;
    reasons.push("무게 2kg 이상 — 배송비·파손 리스크");
  }

  score = Math.min(100, score);

  let level: CsRiskLevel = "low";
  let label = "낮음";
  if (score >= 55) {
    level = "high";
    label = "높음";
  } else if (score >= 35) {
    level = "medium";
    label = "보통";
  }

  if (reasons.length === 0) {
    reasons.push("고위험 카테고리·과중량 신호 없음");
  }

  return { level, label, score, reasons };
}
