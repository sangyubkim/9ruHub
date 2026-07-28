import { describe, expect, it } from "vitest";
import {
  buildDecisionGuide,
  estimateNetProfitKrw,
  shippingFeeRangeKrw,
} from "./decision-guide";

const rule = {
  marginRate: 0.2,
  platformFeeRate: 0.1,
  cardFeeRate: 0.025,
  minMarginRate: 0.05,
  undercutRate: 0.02,
  roundTo: 100,
};

describe("estimateNetProfitKrw", () => {
  it("수수료 차감 후 순이익을 계산한다", () => {
    // 14900 * 0.875 - 8370 ≈ 4667.5
    expect(estimateNetProfitKrw(14900, 8370, 0.1, 0.025)).toBe(4668);
  });
});

describe("shippingFeeRangeKrw", () => {
  it("무게 변동으로 배송 범위를 만든다", () => {
    const r = shippingFeeRangeKrw({
      weightGrams: 500,
      midFeeKrw: 18000,
      region: "US",
    });
    expect(r.low).toBeLessThanOrEqual(r.mid);
    expect(r.high).toBeGreaterThanOrEqual(r.mid);
  });
});

describe("buildDecisionGuide", () => {
  it("범위·추천점·이익·등급을 제시한다", () => {
    const g = buildDecisionGuide({
      productCostKrw: 4370,
      shippingMidKrw: 4500,
      weightGrams: 400,
      competitorAvgKrw: 14900,
      marketVerdictCode: "SELL",
      isFallback: false,
      weightSource: "amazon_parse",
      rule,
    });

    expect(g.shippingLowKrw).toBeLessThanOrEqual(g.shippingHighKrw);
    expect(g.saleLowKrw).toBeLessThanOrEqual(g.saleHighKrw);
    expect(g.recommendedSaleKrw).toBeGreaterThanOrEqual(g.minViableSaleKrw);
    expect(g.competitorAvgKrw).toBe(14900);
    expect(g.expectedProfitKrw).toBeGreaterThan(0);
    expect(["A", "B", "C", "D"]).toContain(g.grade);
    expect(g.competitionStars).toBeGreaterThanOrEqual(1);
    expect(g.summary.length).toBeGreaterThan(0);
    expect(g.assumptions.length).toBeGreaterThan(0);
  });

  it("폴백이면 등급 D·위험 높음", () => {
    const g = buildDecisionGuide({
      productCostKrw: 10000,
      shippingMidKrw: 15000,
      weightGrams: 500,
      competitorAvgKrw: null,
      isFallback: true,
      weightSource: "default",
      rule,
    });
    expect(g.grade).toBe("D");
    expect(g.risk).toBe("high");
  });

  it("경쟁 시세가 손익분기 아래면 원가 기준으로 추천한다", () => {
    const g = buildDecisionGuide({
      productCostKrw: 30000,
      shippingMidKrw: 20000,
      weightGrams: 800,
      competitorAvgKrw: 35000,
      marketVerdictCode: "NOT_RECOMMENDED",
      isFallback: false,
      weightSource: "amazon_parse",
      rule,
    });
    expect(g.recommendedSaleKrw).toBeGreaterThanOrEqual(g.minViableSaleKrw);
    expect(g.summary).toMatch(/손익분기|원가/);
  });

  it("SCARCE면 마진 확보형·시세 프리미엄 추천", () => {
    const g = buildDecisionGuide({
      productCostKrw: 20000,
      shippingMidKrw: 8000,
      weightGrams: 500,
      competitorAvgKrw: 39900,
      marketType: "SCARCE",
      isFallback: false,
      weightSource: "amazon_parse",
      rule,
    });
    expect(g.marketType).toBe("SCARCE");
    expect(g.summary).toMatch(/희소|마진/);
    expect(g.recommendedSaleKrw).toBeGreaterThanOrEqual(g.minViableSaleKrw);
    // undercut(시세×0.98)보다 높거나 같아야 함
    expect(g.recommendedSaleKrw).toBeGreaterThanOrEqual(
      Math.round(39900 * 0.98),
    );
  });

  it("PRICE_WAR면 위험 높음·저등급", () => {
    const g = buildDecisionGuide({
      productCostKrw: 5000,
      shippingMidKrw: 4000,
      weightGrams: 200,
      competitorAvgKrw: 9900,
      marketType: "PRICE_WAR",
      isFallback: false,
      weightSource: "amazon_parse",
      rule,
    });
    expect(g.risk).toBe("high");
    expect(["C", "D"]).toContain(g.grade);
  });
});
