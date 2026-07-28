import { describe, expect, it } from "vitest";
import { withAmazonScoreFeatures } from "@/lib/recommend/amazon-features";
import type { ScoreBreakdown } from "@/lib/recommend/score";

describe("withAmazonScoreFeatures", () => {
  it("UI용 sell/cost/margin features를 붙인다", () => {
    const breakdown: ScoreBreakdown = {
      total: 78,
      marginScore: 35,
      priceBandScore: 25,
      stockScore: 15,
      brandScore: 10,
      imageScore: 10,
      listingPenalty: 0,
      salesBoost: 0,
      reasons: ["고마진(35%+)"],
    };
    const out = withAmazonScoreFeatures(
      breakdown,
      {
        salePriceKrw: 27300,
        costKrw: 35745,
        sourcePriceKrw: 17745,
        productCostKrw: 17745,
        weightGrams: 500,
        targetMarginRate: 0.2,
        platformFeeRate: 0.1,
        cardFeeRate: 0.025,
        minMarginRate: 0.05,
        undercutRate: 0.02,
        roundTo: 100,
        intlShippingKrw: 18000,
        minViableSaleKrw: 43000,
        shipping: {
          feeKrw: 18000,
          weightGrams: 500,
          billableLbs: 2,
          totalUsd: 13.04,
          provider: "malltail",
          tier: "general",
          note: "malltail air lbs + fuel $1",
          weightSource: "amazon_parse",
        },
      },
      19.99,
      {
        intlShippingKrw: 18000,
        competitorAvgKrw: 39900,
        isFallback: false,
        naverKeyword: "AirPods Pro",
        targetMarginRate: 0.2,
        shipping: {
          feeKrw: 18000,
          weightGrams: 500,
          billableLbs: 2,
          totalUsd: 13.04,
          provider: "malltail",
          tier: "general",
          note: "malltail air lbs + fuel $1",
          weightSource: "amazon_parse",
        },
      },
    );
    expect(out.features.sourceCostKrw).toBe(17745);
    expect(out.features.landedCostKrw).toBe(35745);
    expect(out.features.sourcePriceUsd).toBe(19.99);
    expect(out.features.marginRate).toBeCloseTo((27300 - 35745) / 27300, 2);
    expect(out.features.targetMarginRate).toBe(0.2);
    expect(out.features.intlShippingKrw).toBe(18000);
    expect(out.features.shipping?.billableLbs).toBe(2);
    expect(out.features.competitorAvgKrw).toBe(39900);
    expect(out.features.isFallback).toBe(false);
    expect(out.features.decisionGuide).toBeTruthy();
    expect(out.features.decisionGuide?.recommendedSaleKrw).toBeGreaterThan(0);
    expect(out.features.sellPriceKrw).toBe(
      out.features.decisionGuide?.recommendedSaleKrw,
    );
    expect(out.features.productViability).toBeTruthy();
    expect(out.features.productViability?.marketType).toBeTruthy();
    expect(out.features.productViability?.recommendStars).toBeGreaterThanOrEqual(
      1,
    );
    expect(out.total).toBe(78);
  });
});
