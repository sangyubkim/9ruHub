import { describe, expect, it } from "vitest";
import { evaluateMarketViability, splitIntlShipping } from "./viability";

describe("evaluateMarketViability", () => {
  it("marks SELL when minViable within ceiling", () => {
    const v = evaluateMarketViability({
      minViableSaleKrw: 10000,
      costPlusSaleKrw: 12000,
      competitorAvgKrw: 9800,
      ceilingRate: 1.15,
    });
    // ceiling = 9800*1.15 = 11270 → 10000 <= 11270
    expect(v.code).toBe("SELL");
    expect(v.marketCeilingKrw).toBe(11270);
  });

  it("marks NOT_RECOMMENDED when far above market", () => {
    const v = evaluateMarketViability({
      minViableSaleKrw: 27300,
      costPlusSaleKrw: 27300,
      competitorAvgKrw: 9800,
      ceilingRate: 1.15,
      consolidatedMinViableKrw: 20000,
    });
    expect(v.code).toBe("NOT_RECOMMENDED");
    expect(v.ratioToMarket).toBeGreaterThan(2);
  });

  it("marks NEED_CONSOLIDATION when only split shipping fits", () => {
    const v = evaluateMarketViability({
      minViableSaleKrw: 27300,
      costPlusSaleKrw: 27300,
      competitorAvgKrw: 15000,
      ceilingRate: 1.15,
      consolidationUnits: 5,
      consolidatedMinViableKrw: 16000, // ceiling 17250
    });
    expect(v.code).toBe("NEED_CONSOLIDATION");
  });

  it("marks NO_MARKET_DATA without competitors", () => {
    const v = evaluateMarketViability({
      minViableSaleKrw: 10000,
      costPlusSaleKrw: 12000,
    });
    expect(v.code).toBe("NO_MARKET_DATA");
  });
});

describe("splitIntlShipping", () => {
  it("divides shipping across units", () => {
    expect(splitIntlShipping(15000, 5)).toBe(3000);
  });
});
