import type { SupplyMallAdapter, SupplyOffer } from "@/lib/discover/types";
import { SupplyMall } from "@/generated/prisma/client";
import { Mall1688SupplyStubAdapter } from "@/lib/discover/supply/mall1688-stub";
import { search1688Offers } from "@/lib/discover/supply/search-1688";

/**
 * 1688 키워드 검색 라이브 어댑터.
 * 차단·파싱 실패 시 stub 폴백(auto 모드).
 */
export class Mall1688SupplyLiveAdapter implements SupplyMallAdapter {
  readonly name = "mall1688-supply-live";
  readonly mall = SupplyMall.MALL_1688;

  constructor(private readonly fallbackToStub: boolean) {}

  async fetchSupplyOffers(keyword: string, limit = 3): Promise<SupplyOffer[]> {
    const result = await search1688Offers(keyword, {
      limit,
      enrichLimit: Math.min(limit, 3),
    });

    if (result.offers.length > 0) {
      return result.offers;
    }

    console.warn(
      "[discover] 1688 live search empty →",
      result.fetchError ?? "no_offers",
      result.searchUrl,
    );

    if (!this.fallbackToStub) {
      return [];
    }

    const stub = await new Mall1688SupplyStubAdapter().fetchSupplyOffers(
      keyword,
      limit,
    );
    return stub.map((o) => ({
      ...o,
      raw: {
        ...(o.raw ?? {}),
        liveFallback: true,
        liveError: result.fetchError ?? "no_offers",
        searchUrl: result.searchUrl,
      },
    }));
  }
}

export function shouldUse1688LiveSupply(): boolean {
  const mode = (process.env.DISCOVER_1688_MODE ?? "auto").toLowerCase();
  if (mode === "stub" || mode === "demo") return false;
  if (mode === "live") return true;
  // auto: 라이브 시도 (실패 시 어댑터에서 stub 폴백)
  return true;
}

export function create1688SupplyAdapter(): SupplyMallAdapter {
  const mode = (process.env.DISCOVER_1688_MODE ?? "auto").toLowerCase();
  if (mode === "stub" || mode === "demo") {
    return new Mall1688SupplyStubAdapter();
  }
  // live: 폴백 없음 / auto: 폴백 있음
  return new Mall1688SupplyLiveAdapter(mode !== "live");
}
