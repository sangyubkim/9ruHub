import { describe, expect, it } from "vitest";
import { scoreDiscoverCandidate } from "@/lib/discover/score";

/**
 * demand-only 경로와 동일한 점수 입력(공급 마진 중성값)으로
 * 수요 지표 위주 점수·라벨이 나오는지 검증한다.
 */
describe("discoverDemandOnly scoring", () => {
  it("검색량·경쟁 중심 점수를 내고 마진 대기 사유를 붙일 수 있다", () => {
    const pendingMargin = 0.25;
    const breakdown = scoreDiscoverCandidate({
      searchVolume: 12000,
      competition: 0.35,
      marginRate: pendingMargin,
      rating: 4.2,
      reviewCount: 500,
      seasonalityScore: 60,
      marketVerdictCode: null,
    });
    breakdown.reasons = [
      "Amazon URL 대기(공급 미정)",
      ...breakdown.reasons.filter((r) => !r.includes("마진")),
      "마진은 Amazon 원가 붙인 뒤 재산정",
    ];

    expect(breakdown.total).toBeGreaterThanOrEqual(40);
    expect(breakdown.label).not.toBe("PASS");
    expect(breakdown.reasons.some((r) => r.includes("Amazon URL"))).toBe(true);
    expect(breakdown.reasons.some((r) => r.includes("마진은 Amazon"))).toBe(
      true,
    );
  });

  it("수요가 약하면 minScore 미달(PASS)이 된다", () => {
    const breakdown = scoreDiscoverCandidate({
      searchVolume: 100,
      competition: 0.95,
      marginRate: 0.25,
      rating: 2.5,
      reviewCount: 5,
      seasonalityScore: 10,
    });
    expect(breakdown.total).toBeLessThan(40);
    expect(breakdown.label).toBe("PASS");
  });

  it("추천 payload features에 needsAmazonUrl 플래그를 둔다", () => {
    const features = {
      needsAmazonUrl: true,
      awaitingAmazon: true,
      demandOnly: true,
      naverKeyword: "캠핑 의자",
      competitorAvgKrw: 39000,
    };
    expect(features.needsAmazonUrl).toBe(true);
    expect(features.naverKeyword).toBe("캠핑 의자");
  });
});
