import { describe, expect, it } from "vitest";
import {
  buildScarcityAssessment,
  priceDispersionRatio,
} from "@/lib/recommend/scarcity";

describe("priceDispersionRatio", () => {
  it("군집 시세는 낮은 분산을 반환한다", () => {
    const r = priceDispersionRatio([9900, 10000, 10100, 9950, 10050]);
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(0.05);
  });
});

describe("buildScarcityAssessment", () => {
  it("이어폰·키워드+등록+시세군집 → PRICE_WAR", () => {
    const a = buildScarcityAssessment({
      keyword: "이어폰",
      shopTotal: 120_000,
      uniqueMallCount: 15,
      prices: [8900, 9000, 9100, 9200, 8950, 9050],
      competition: 0.9,
      searchVolume: 20000,
    });
    expect(a.marketType).toBe("PRICE_WAR");
    expect(a.score).toBeLessThanOrEqual(40);
    expect(a.strategy).toMatch(/비추천|가격 경쟁/);
    expect(a.marketTypeReason).toMatch(/신호 합/);
    expect(a.referenceLinks.some((l) => l.href.includes("shopping.naver.com"))).toBe(
      true,
    );
    expect(a.breakdown.every((b) => b.criteria.length > 0)).toBe(true);
    expect(a.methodology.length).toBeGreaterThan(0);
  });

  it("등록 hit만 많아도 PRICE_WAR로 단정하지 않는다", () => {
    const a = buildScarcityAssessment({
      keyword: "캠핑 랜턴 거치대",
      shopTotal: 540_000,
      uniqueMallCount: 6,
      prices: [12000, 28000, 45000, 19000, 33000],
      competition: 0.5,
      searchVolume: 4000,
    });
    expect(a.marketType).not.toBe("PRICE_WAR");
    expect(["UNCLEAR", "SCARCE"]).toContain(a.marketType);
  });

  it("등록 적고 해외 키워드 → SCARCE", () => {
    const a = buildScarcityAssessment({
      keyword: "일본 한정 굿즈",
      brand: "Acme Outdoor",
      shopTotal: 40,
      uniqueMallCount: 2,
      prices: [29000, 45000, 38000],
      competition: 0.2,
      searchVolume: 1500,
    });
    expect(a.marketType).toBe("SCARCE");
    expect(a.score).toBeGreaterThanOrEqual(45);
    expect(a.strategy).toMatch(/희소|마진/);
  });
});
