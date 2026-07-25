import { describe, expect, it } from "vitest";
import { reasonCodeFromScore, scoreCandidate } from "@/lib/recommend/score";

describe("scoreCandidate", () => {
  it("scores strong candidates highly without GPT", () => {
    const result = scoreCandidate({
      title: "Wireless Earbuds",
      brand: "Sony",
      sourcePriceUsd: 39,
      salePriceKrw: 89000,
      costKrw: 52000,
      inStock: true,
      imageCount: 4,
      alreadyListed: false,
      recentSales: 2,
    });

    expect(result.total).toBeGreaterThanOrEqual(75);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(reasonCodeFromScore(result.total)).toBe("STRONG_BUY");
  });

  it("penalizes already listed and OOS items", () => {
    const result = scoreCandidate({
      title: "Thing",
      sourcePriceUsd: 200,
      salePriceKrw: 300000,
      costKrw: 280000,
      inStock: false,
      imageCount: 0,
      alreadyListed: true,
    });

    expect(result.listingPenalty).toBe(-20);
    expect(result.stockScore).toBe(0);
    expect(result.total).toBeLessThan(55);
  });
});
