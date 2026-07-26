import { SupplyMall } from "@/generated/prisma/client";
import { build1688SearchUrl } from "@/lib/discover/supply/search-1688";
import type { SupplyMallAdapter, SupplyOffer } from "@/lib/discover/types";

/**
 * 1688 공급가 스텁.
 * 키워드당 2–3개 샘플 오퍼(원가 CNY)를 반환.
 * 가짜 detail URL(404) 대신 키워드 검색 URL을 넣어 「원본 보기」가 깨지지 않게 한다.
 */
export class Mall1688SupplyStubAdapter implements SupplyMallAdapter {
  readonly name = "mall1688-supply-stub";
  readonly mall = SupplyMall.MALL_1688;

  async fetchSupplyOffers(keyword: string, limit = 3): Promise<SupplyOffer[]> {
    const seed = hashKeyword(keyword);
    const count = Math.min(Math.max(limit, 1), 5);
    const offers: SupplyOffer[] = [];
    const searchUrl = build1688SearchUrl(keyword);

    for (let i = 0; i < count; i += 1) {
      const local = seed + i * 9973;
      const costPriceCny = round2(8 + (local % 120) + i * 3.5);
      // DB unique용 가짜 id (숫자 offer id가 아님 — detail URL로 쓰지 말 것)
      const externalSupplyId = `stub-${(local % 1_000_000_000).toString(16)}-${i}`;
      offers.push({
        mall: SupplyMall.MALL_1688,
        title: `${keyword.trim()} 도매 오퍼 #${i + 1}`,
        supplyUrl: searchUrl,
        externalSupplyId,
        costPriceCny,
        moq: 1 + (local % 20),
        isStub: true,
        raw: {
          provider: this.name,
          note: "demo cost — not live crawl; supplyUrl is keyword search",
          index: i,
          searchUrl,
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
