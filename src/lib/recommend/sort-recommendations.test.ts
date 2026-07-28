import { describe, expect, it } from "vitest";
import {
  filterRecommendationsByProxyBuy,
  filterRecommendationsByVerdict,
  isNotRecommendedBreakdown,
  isProxyBuyFitCode,
  parseProxyBuyFilter,
  readSourcingFitCode,
  sortRecommendationsByViability,
  verdictFromStars,
} from "@/lib/recommend/sort-recommendations";

function item(
  id: string,
  stars: number,
  scarcity: number,
  score: number,
  createdAt: string,
) {
  return {
    id,
    score,
    createdAt,
    scoreBreakdown: {
      features: {
        productViability: {
          recommendStars: stars,
          scarcityScore: scarcity,
        },
      },
    },
  };
}

describe("sortRecommendationsByViability", () => {
  it("추천도(★) 높은 순으로 정렬한다", () => {
    const sorted = sortRecommendationsByViability([
      item("a", 2, 10, 90, "2026-01-01T00:00:00Z"),
      item("b", 4, 20, 50, "2026-01-02T00:00:00Z"),
      item("c", 3, 80, 60, "2026-01-03T00:00:00Z"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("동점이면 희소성·점수 순", () => {
    const sorted = sortRecommendationsByViability([
      item("a", 3, 10, 90, "2026-01-01T00:00:00Z"),
      item("b", 3, 50, 40, "2026-01-02T00:00:00Z"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("희소성 동점이면 sourcingFit 높은 순", () => {
    const withFit = (id: string, fitScore: number) => ({
      id,
      score: 50,
      createdAt: "2026-01-01T00:00:00Z",
      scoreBreakdown: {
        features: {
          productViability: {
            recommendStars: 4,
            scarcityScore: 70,
            sourcingFit: { score: fitScore },
          },
        },
      },
    });
    const sorted = sortRecommendationsByViability([
      withFit("low", 25),
      withFit("high", 92),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["high", "low"]);
  });
});

describe("filterRecommendationsByVerdict", () => {
  it("recommend/hold/reject로 나눈다", () => {
    const items = [
      item("r", 5, 0, 1, "2026-01-01T00:00:00Z"),
      item("h", 3, 0, 1, "2026-01-01T00:00:00Z"),
      item("x", 1, 0, 1, "2026-01-01T00:00:00Z"),
    ];
    expect(
      filterRecommendationsByVerdict(items, "recommend").map((i) => i.id),
    ).toEqual(["r"]);
    expect(
      filterRecommendationsByVerdict(items, "hold").map((i) => i.id),
    ).toEqual(["h"]);
    expect(
      filterRecommendationsByVerdict(items, "reject").map((i) => i.id),
    ).toEqual(["x"]);
  });
});

describe("proxy buy filter", () => {
  it("PROXY_BUY_STRONG / PROXY_BUY 만 통과", () => {
    const withCode = (id: string, code: string | null) => ({
      id,
      scoreBreakdown: code
        ? {
            features: {
              productViability: {
                recommendStars: 4,
                scarcityScore: 50,
                sourcingFit: { code, score: 90, label: code },
              },
            },
          }
        : { features: { productViability: { recommendStars: 4 } } },
    });
    const items = [
      withCode("strong", "PROXY_BUY_STRONG"),
      withCode("proxy", "PROXY_BUY"),
      withCode("risk", "DIRECT_SHIP_RISK"),
      withCode("none", null),
    ];
    expect(
      filterRecommendationsByProxyBuy(items, "proxy").map((i) => i.id),
    ).toEqual(["strong", "proxy"]);
    expect(filterRecommendationsByProxyBuy(items, "all")).toHaveLength(4);
  });

  it("features.sourcingFit 루트도 읽는다", () => {
    expect(
      readSourcingFitCode({
        features: { sourcingFit: { code: "PROXY_BUY_STRONG" } },
      }),
    ).toBe("PROXY_BUY_STRONG");
    expect(isProxyBuyFitCode("PROXY_BUY_STRONG")).toBe(true);
    expect(isProxyBuyFitCode("US_FAIL")).toBe(false);
    expect(parseProxyBuyFilter("1")).toBe("proxy");
    expect(parseProxyBuyFilter(undefined)).toBe("all");
  });
});

describe("verdict helpers", () => {
  it("별점 구간", () => {
    expect(verdictFromStars(4)).toBe("recommend");
    expect(verdictFromStars(3)).toBe("hold");
    expect(verdictFromStars(2)).toBe("reject");
  });

  it("비추천 breakdown 판별", () => {
    expect(
      isNotRecommendedBreakdown({
        features: { productViability: { recommendStars: 2 } },
      }),
    ).toBe(true);
    expect(
      isNotRecommendedBreakdown({
        features: { productViability: { recommendStars: 4 } },
      }),
    ).toBe(false);
  });
});
