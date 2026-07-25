import { describe, expect, it } from "vitest";
import { computeCompetitorBand, recommendSalePrice } from "./recommend";

const base = {
  cost: 20000,
  chinaShipping: 3000,
  intlShipping: 12000,
  dutyRate: 0.1,
  agencyFee: 2000,
  marginRate: 0.2,
  platformFeeRate: 0.1,
  cardFeeRate: 0.025,
  minMarginRate: 0.05,
  undercutRate: 0.02,
  roundTo: 100,
  currency: "KRW" as const,
};

describe("recommendSalePrice", () => {
  it("경쟁가 없으면 cost-plus 추천", () => {
    const result = recommendSalePrice(base);
    // landed = 20000+3000+12000+2000(duty)+2000 = 39000
    // *1.2 / (1-0.1-0.025) = 46800 / 0.875 = 53485.71 → 53500
    expect(result.landedCostKrw).toBe(39000);
    expect(result.costPlusSaleKrw).toBe(53500);
    expect(result.recommendedSalePriceKrw).toBe(53500);
    expect(result.strategyCode).toBe("cost_plus");
    expect(result.competitors).toBeNull();
    expect(result.explanation).toContain("경쟁가 정보가 없어");
  });

  it("경쟁 평균보다 cost-plus가 낮으면 마진 유지", () => {
    const result = recommendSalePrice({
      ...base,
      competitors: [80000, 90000, 100000],
    });
    expect(result.competitors?.avg).toBe(90000);
    expect(result.recommendedSalePriceKrw).toBe(result.costPlusSaleKrw);
    expect(result.strategyCode).toBe("cost_plus_below_market");
  });

  it("경쟁가가 낮고 마진 여유가 있으면 평균 소폭 하회", () => {
    // cost-plus ~53500, avg 70000 → target 68600 → undercut
    const result = recommendSalePrice({
      ...base,
      // raise cost so cost-plus is above target
      cost: 50000,
      competitors: [60000, 62000, 64000],
    });
    // landed = 50000+3000+12000+5000+2000 = 72000
    // *1.2/0.875 = 98742.8 → 98800
    expect(result.costPlusSaleKrw).toBe(98800);
    expect(result.competitors?.avg).toBe(62000);
    expect(result.targetSaleKrw).toBe(60800); // 62000 * 0.98 → 60760 → 60800
    // minViable: 72000*1.05/0.875 = 86400
    expect(result.minViableSaleKrw).toBe(86400);
    expect(result.recommendedSalePriceKrw).toBe(86400);
    expect(result.strategyCode).toBe("competitor_clamp_min_margin");
  });

  it("고경쟁가에서 cost-plus가 목표보다 높고 마진 여유 있으면 평균 소폭 하회", () => {
    const result = recommendSalePrice({
      cost: 55000,
      chinaShipping: 5000,
      intlShipping: 10000,
      duty: 3000,
      agencyFee: 2000,
      marginRate: 0.2,
      minMarginRate: 0.05,
      cardFeeRate: 0.025,
      platformFeeRate: 0.1,
      undercutRate: 0.02,
      roundTo: 100,
      competitors: [90000, 100000, 110000],
    });
    // landed = 75000; cost-plus 102858→102900; minViable 90000; target 98000
    expect(result.landedCostKrw).toBe(75000);
    expect(result.costPlusSaleKrw).toBe(102900);
    expect(result.targetSaleKrw).toBe(98000);
    expect(result.recommendedSalePriceKrw).toBe(98000);
    expect(result.strategyCode).toBe("competitor_undercut");
  });

  it("USD 원가를 KRW로 환산", () => {
    const result = recommendSalePrice({
      cost: 20,
      currency: "USD",
      usdToKrw: 1000,
      chinaShipping: 0,
      intlShipping: 10000,
      dutyRate: 0.1,
      agencyFee: 2000,
      marginRate: 0.2,
      platformFeeRate: 0.1,
      cardFeeRate: 0,
      roundTo: 100,
    });
    expect(result.sourceCostKrw).toBe(20000);
    expect(result.recommendedSalePriceKrw).toBe(45400);
  });
});

describe("computeCompetitorBand", () => {
  it("배열에서 min/avg/max 계산", () => {
    expect(computeCompetitorBand([10, 20, 30])).toEqual({
      min: 10,
      avg: 20,
      max: 30,
      count: 3,
    });
  });

  it("빈 배열이면 null (명시 avg 없을 때)", () => {
    expect(computeCompetitorBand([])).toBeNull();
    expect(computeCompetitorBand(undefined, 100, 150, 200)).toEqual({
      min: 100,
      avg: 150,
      max: 200,
      count: 0,
    });
  });
});
