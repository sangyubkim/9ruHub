import { describe, expect, it } from "vitest";
import { buildDecisionGuide } from "@/lib/recommend/decision-guide";
import { buildProductViability } from "@/lib/recommend/product-viability";

const rule = {
  marginRate: 0.2,
  platformFeeRate: 0.1,
  cardFeeRate: 0.025,
  minMarginRate: 0.05,
  undercutRate: 0.02,
  roundTo: 100,
};

describe("buildProductViability", () => {
  it("가격전쟁 키워드는 낮은 추천 별점", () => {
    const v = buildProductViability({
      keyword: "텀블러",
      shopTotal: 8000,
      uniqueMallCount: 12,
      prices: [9900, 10000, 10100, 9800, 10200],
      competition: 0.85,
      searchVolume: 30000,
    });
    expect(v.marketType).toBe("PRICE_WAR");
    expect(v.recommendStars).toBeLessThanOrEqual(2);
    expect(v.csRiskLabel.length).toBeGreaterThan(0);
    expect(v.referenceLinks.length).toBeGreaterThan(0);
    expect(v.scarcityBreakdown[0]?.criteria).toBeTruthy();
    expect(v.csRiskReasons.length).toBeGreaterThan(0);
  });

  it("공급 대기면 비추천 라벨을 완화한다", () => {
    const v = buildProductViability({
      keyword: "텀블러",
      shopTotal: 8000,
      uniqueMallCount: 12,
      prices: [9900, 10000, 10100, 9800, 10200],
      competition: 0.85,
      searchVolume: 30000,
      awaitingSupply: true,
    });
    expect(v.recommendLabel).toMatch(/공급 확인 전/);
    expect(v.strategy).toMatch(/최종 판정은 Amazon/);
  });

  it("희소 + decisionGuide면 판매가·마진을 카드에 담는다", () => {
    const guide = buildDecisionGuide({
      productCostKrw: 20000,
      shippingMidKrw: 8000,
      weightGrams: 500,
      competitorAvgKrw: 35000,
      marketType: "SCARCE",
      rule,
    });
    const v = buildProductViability({
      keyword: "코스트코 전용",
      brand: "Kirkland",
      shopTotal: 30,
      uniqueMallCount: 1,
      prices: [32000, 39000],
      decisionGuide: guide,
      competitorAvgKrw: 35000,
    });
    expect(v.marketType).toBe("SCARCE");
    expect(v.recommendedSaleKrw).toBe(guide.recommendedSaleKrw);
    expect(v.expectedProfitKrw).toBe(guide.expectedProfitKrw);
    expect(v.recommendStars).toBeGreaterThanOrEqual(3);
  });

  it("KR 직배송 불가 + 국내 희소면 구매대행 우선 라벨", () => {
    const v = buildProductViability({
      keyword: "코스트코 전용",
      brand: "Kirkland",
      shopTotal: 30,
      uniqueMallCount: 1,
      prices: [32000, 39000],
      shipEligibility: {
        us: { country: "US", status: "ok", confidence: "high", evidence: "In Stock" },
        kr: {
          country: "KR",
          status: "fail",
          confidence: "high",
          evidence: "cannot be shipped",
        },
        krDirectShip: false,
        usForwarderOk: true,
        confidence: "high",
        source: "env_override",
        checkedAt: "2026-07-28T00:00:00.000Z",
        note: null,
      },
    });
    expect(v.sourcingFit?.code).toBe("PROXY_BUY_STRONG");
    expect(v.recommendLabel).toMatch(/구매대행/);
    expect(v.shipEligibility?.krDirectShip).toBe(false);
  });
});
