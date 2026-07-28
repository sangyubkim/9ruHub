/**
 * 구매대행 적합성: KR 직배송 불가 + 국내 경쟁 적음 조합.
 */

import type { AmazonShipEligibility } from "@/lib/amazon/ship-eligibility";
import type { MarketType } from "@/lib/recommend/scarcity";

export type SourcingFitCode =
  | "PROXY_BUY_STRONG"
  | "PROXY_BUY"
  | "DIRECT_SHIP_RISK"
  | "US_FAIL"
  | "UNCLEAR";

export type SourcingFit = {
  code: SourcingFitCode;
  /** 정렬용 0~100 */
  score: number;
  label: string;
  summary: string;
  /** 추천 ★ 가감 (−1~+1) */
  recommendBoost: number;
  domesticLow: boolean;
  krDirectShip: boolean | null;
  usForwarderOk: boolean | null;
};

export function isDomesticCompetitionLow(input: {
  marketType?: MarketType | null;
  shopTotal?: number | null;
  scarcityScore?: number | null;
}): boolean {
  if (input.marketType === "SCARCE") return true;
  if (input.marketType === "PRICE_WAR") return false;
  if (
    input.scarcityScore != null &&
    Number.isFinite(input.scarcityScore) &&
    input.scarcityScore >= 65
  ) {
    return true;
  }
  if (
    input.shopTotal != null &&
    Number.isFinite(input.shopTotal) &&
    input.shopTotal >= 0 &&
    input.shopTotal < 200
  ) {
    return true;
  }
  return false;
}

export function buildSourcingFit(input: {
  ship?: AmazonShipEligibility | null;
  marketType?: MarketType | null;
  shopTotal?: number | null;
  scarcityScore?: number | null;
}): SourcingFit {
  const domesticLow = isDomesticCompetitionLow(input);
  const ship = input.ship ?? null;
  const krDirectShip = ship?.krDirectShip ?? null;
  const usForwarderOk = ship?.usForwarderOk ?? null;

  if (!ship || ship.source === "unavailable") {
    return {
      code: "UNCLEAR",
      score: 40,
      label: "배송 적합성 미확인",
      summary: "Amazon 배송국 확인 전이거나 조회 실패 — 제외하지 않음",
      recommendBoost: 0,
      domesticLow,
      krDirectShip,
      usForwarderOk,
    };
  }

  if (usForwarderOk === false) {
    return {
      code: "US_FAIL",
      score: 10,
      label: "US 포워더 수령 불리",
      summary: "미국 주소로도 배송이 어려울 수 있어 포워더 경로가 약함",
      recommendBoost: -1,
      domesticLow,
      krDirectShip,
      usForwarderOk,
    };
  }

  if (krDirectShip === true) {
    return {
      code: "DIRECT_SHIP_RISK",
      score: domesticLow ? 35 : 25,
      label: "한국 직배송 가능",
      summary: domesticLow
        ? "국내 경쟁은 적지만 Amazon 직배송 경쟁 가능 — 마진·차별화 확인"
        : "한국 직배송 가능 → 구매대행 차별화 약할 수 있음",
      recommendBoost: -1,
      domesticLow,
      krDirectShip,
      usForwarderOk,
    };
  }

  if (krDirectShip === false && usForwarderOk === true) {
    if (domesticLow) {
      return {
        code: "PROXY_BUY_STRONG",
        score: 92,
        label: "구매대행 적합(강)",
        summary:
          "US 수령 가능 · KR 직배송 불가 · 국내 경쟁 적음 → 우선 검토",
        recommendBoost: 1,
        domesticLow,
        krDirectShip,
        usForwarderOk,
      };
    }
    return {
      code: "PROXY_BUY",
      score: 72,
      label: "구매대행 적합",
      summary: "US 수령 가능 · KR 직배송 불가 — 국내 경쟁은 별도 확인",
      recommendBoost: 0,
      domesticLow,
      krDirectShip,
      usForwarderOk,
    };
  }

  return {
    code: "UNCLEAR",
    score: 45,
    label: "배송 적합성 불명확",
    summary:
      ship.note ??
      "US/KR 배송 판정이 불완전합니다. 수동 확인 권장(하드 제외 없음)",
    recommendBoost: 0,
    domesticLow,
    krDirectShip,
    usForwarderOk,
  };
}
