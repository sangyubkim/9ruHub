import { describe, expect, it } from "vitest";
import {
  discoverLabelFromScore,
  scoreDiscoverCandidate,
} from "@/lib/discover/score";

describe("scoreDiscoverCandidate", () => {
  it("scores strong Naver↔1688 metrics as STRONG_BUY", () => {
    const result = scoreDiscoverCandidate({
      searchVolume: 28000,
      competition: 0.22,
      marginRate: 0.42,
      rating: 4.7,
      reviewCount: 8000,
      seasonalityScore: 75,
    });

    expect(result.total).toBeGreaterThanOrEqual(75);
    expect(result.label).toBe("STRONG_BUY");
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(discoverLabelFromScore(result.total)).toBe("STRONG_BUY");
  });

  it("returns PASS for weak metrics", () => {
    const result = scoreDiscoverCandidate({
      searchVolume: 200,
      competition: 0.9,
      marginRate: 0.05,
      rating: 2.8,
      reviewCount: 10,
      seasonalityScore: 15,
    });

    expect(result.total).toBeLessThan(40);
    expect(result.label).toBe("PASS");
  });

  it("rewards low competition and healthy margin", () => {
    const result = scoreDiscoverCandidate({
      searchVolume: 9000,
      competition: 0.2,
      marginRate: 0.32,
      rating: 4.1,
      reviewCount: 1200,
      seasonalityScore: 50,
    });

    expect(result.competitionScore).toBe(20);
    expect(result.marginScore).toBe(20);
    expect(result.total).toBeGreaterThanOrEqual(55);
    expect(["BUY", "STRONG_BUY"]).toContain(result.label);
  });
});

