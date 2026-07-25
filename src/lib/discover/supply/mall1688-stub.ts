import { SupplyMall } from "@/generated/prisma/client";
import type { SupplyMallAdapter, SupplyOffer } from "@/lib/discover/types";

/**
 * 1688 공급가 스텁.
 * 키워드당 2–3개 샘플 오퍼(원가 CNY)를 반환. 라이브 크롤은 추후 Playwright.
 */
export class Mall1688SupplyStubAdapter implements SupplyMallAdapter {
  readonly name = "mall1688-supply-stub";
  readonly mall = SupplyMall.MALL_1688;

  async fetchSupplyOffers(keyword: string, limit = 3): Promise<SupplyOffer[]> {
    const seed = hashKeyword(keyword);
    const count = Math.min(Math.max(limit, 1), 5);
    const offers: SupplyOffer[] = [];

    for (let i = 0; i < count; i += 1) {
      const local = seed + i * 9973;
      const costPriceCny = round2(8 + (local % 120) + i * 3.5);
      const externalSupplyId = `1688-${(local % 1_000_000_000).toString(16)}`;
      offers.push({
        mall: SupplyMall.MALL_1688,
        title: `${keyword.trim()} 도매 오퍼 #${i + 1}`,
        supplyUrl: `https://detail.1688.com/offer/${externalSupplyId}.html`,
        externalSupplyId,
        costPriceCny,
        moq: 1 + (local % 20),
        isStub: true,
        raw: {
          provider: this.name,
          note: "demo cost — not live crawl",
          index: i,
        },
      });
    }

    return offers;
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
