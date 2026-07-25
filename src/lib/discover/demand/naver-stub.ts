import { DemandMall } from "@/generated/prisma/client";
import type { DemandMallAdapter, DemandMetrics } from "@/lib/discover/types";

/**
 * 네이버 키워드 수요 메트릭 스텁.
 * 라이브 크롤(Playwright) 전 MVP — 키워드 해시 기반 재현 가능한 샘플 수치.
 */
export class NaverDemandStubAdapter implements DemandMallAdapter {
  readonly name = "naver-demand-stub";
  readonly mall = DemandMall.NAVER;

  async fetchDemand(keyword: string): Promise<DemandMetrics> {
    const seed = hashKeyword(keyword);
    const searchVolume = 800 + (seed % 42000);
    const competition = round4(0.15 + ((seed % 70) / 100));
    const rating = round2(3.6 + ((seed % 14) / 10));
    const reviewCount = 40 + (seed % 18000);
    const salesEstimate = Math.round(searchVolume * (0.02 + (seed % 8) / 100));
    const seasonalityScore = 35 + (seed % 55);

    return {
      mall: DemandMall.NAVER,
      keyword: keyword.trim(),
      title: `[네이버] ${keyword.trim()}`,
      demandUrl: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword.trim())}`,
      externalDemandId: `naver-kw-${seed.toString(16)}`,
      searchVolume,
      competition,
      reviewCount,
      rating: Math.min(5, rating),
      salesEstimate,
      seasonalityScore,
      isStub: true,
      raw: {
        provider: this.name,
        note: "demo metrics — not live crawl",
      },
    };
  }
}

function hashKeyword(keyword: string): number {
  const normalized = keyword.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
