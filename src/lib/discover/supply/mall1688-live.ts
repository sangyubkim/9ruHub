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
      console.info(
        `[discover] 1688 live ok source=${result.source ?? "?"} hits=${result.hitCount}`,
      );
      return result.offers;
    }

    console.warn(
      "[discover] 1688 live search empty →",
      result.fetchError ?? "no_offers",
      result.searchUrl,
      `source_tried=${result.source ?? "none"}`,
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

/**
 * 1688 자동 검색은 계정 제재 위험이 있어 기본 OFF.
 * 명시적으로 DISCOVER_1688_MODE=live 일 때만 라이브 검색.
 * auto 는 더 이상 라이브를 시도하지 않고 stub 과 동일.
 */
export function shouldUse1688LiveSupply(): boolean {
  const mode = (process.env.DISCOVER_1688_MODE ?? "stub").toLowerCase();
  return mode === "live";
}

export function create1688SupplyAdapter(): SupplyMallAdapter {
  const mode = (process.env.DISCOVER_1688_MODE ?? "stub").toLowerCase();
  if (mode === "live") {
    return new Mall1688SupplyLiveAdapter(false);
  }
  if (mode === "auto") {
    console.warn(
      "[discover] DISCOVER_1688_MODE=auto 는 비활성(제재 위험). stub 사용. 실검색은 MODE=live 만 허용.",
    );
  }
  return new Mall1688SupplyStubAdapter();
}
