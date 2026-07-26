import {
  fetchNaverShopSearch,
  hasNaverOpenApiCredentials,
  type NaverShopItem,
} from "@/lib/discover/demand/naver-shop-api";

export type CompetitorSample = {
  title: string;
  link: string;
  priceKrw: number;
  mallName: string;
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function samplesFromNaverShopItems(
  items: NaverShopItem[],
  options?: { maxPrices?: number; maxSamples?: number },
): {
  prices: number[];
  avg: number | null;
  samples: CompetitorSample[];
} {
  const maxPrices = options?.maxPrices ?? 20;
  const maxSamples = options?.maxSamples ?? 5;

  const priced = items
    .map((item) => {
      const priceKrw = Number(item.lprice);
      if (!Number.isFinite(priceKrw) || priceKrw < 1000 || priceKrw > 50_000_000) {
        return null;
      }
      if (!item.link?.startsWith("http")) return null;
      return {
        title: stripHtml(item.title) || "네이버 상품",
        link: item.link,
        priceKrw,
        mallName: item.mallName?.trim() || "쇼핑몰",
      } satisfies CompetitorSample;
    })
    .filter((x): x is CompetitorSample => x != null)
    .slice(0, maxPrices);

  if (priced.length === 0) {
    return { prices: [], avg: null, samples: [] };
  }

  const prices = priced.map((p) => p.priceKrw);
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  return {
    prices,
    avg,
    samples: priced.slice(0, maxSamples),
  };
}

/**
 * 네이버 쇼핑 검색 최저가 목록 → 경쟁가(원) 배열 + 샘플 링크.
 * 동일 SKU가 아니라 키워드 유사 상품 시세(시장 밴드)입니다.
 */
export async function fetchNaverCompetitorPrices(
  keyword: string,
  options?: { display?: number; maxPrices?: number; maxSamples?: number },
): Promise<{
  prices: number[];
  avg: number | null;
  samples: CompetitorSample[];
  source: "naver_shop" | "unavailable";
  keyword: string;
}> {
  const trimmed = keyword.trim();
  if (!trimmed || !hasNaverOpenApiCredentials()) {
    return {
      prices: [],
      avg: null,
      samples: [],
      source: "unavailable",
      keyword: trimmed,
    };
  }

  try {
    const shop = await fetchNaverShopSearch(trimmed, {
      display: options?.display ?? 40,
      sort: "asc",
    });
    const parsed = samplesFromNaverShopItems(shop.items, {
      maxPrices: options?.maxPrices,
      maxSamples: options?.maxSamples,
    });
    return {
      ...parsed,
      source: "naver_shop",
      keyword: trimmed,
    };
  } catch {
    return {
      prices: [],
      avg: null,
      samples: [],
      source: "unavailable",
      keyword: trimmed,
    };
  }
}
