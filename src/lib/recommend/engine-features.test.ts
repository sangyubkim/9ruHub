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
      { salePriceKrw: 27300, costKrw: 17745 },
      19.99,
    );
    expect(out.features.sellPriceKrw).toBe(27300);
    expect(out.features.sourceCostKrw).toBe(17745);
    expect(out.features.sourcePriceUsd).toBe(19.99);
    expect(out.features.marginRate).toBeCloseTo(0.35, 2);
    expect(out.total).toBe(78);
  });
});
