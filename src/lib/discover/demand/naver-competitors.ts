import {
  fetchNaverShopSearch,
  hasNaverOpenApiCredentials,
} from "@/lib/discover/demand/naver-shop-api";

/**
 * 네이버 쇼핑 검색 최저가 목록 → 경쟁가(원) 배열.
 * 발굴 sellPrice를 경쟁가로 쓰지 않도록 실시세만 사용.
 */
export async function fetchNaverCompetitorPrices(
  keyword: string,
  options?: { display?: number; maxPrices?: number },
): Promise<{
  prices: number[];
  avg: number | null;
  source: "naver_shop" | "unavailable";
}> {
  if (!hasNaverOpenApiCredentials()) {
    return { prices: [], avg: null, source: "unavailable" };
  }

  try {
    const shop = await fetchNaverShopSearch(keyword, {
      display: options?.display ?? 40,
      sort: "asc",
    });
    const prices = shop.items
      .map((item) => Number(item.lprice))
      .filter((n) => Number.isFinite(n) && n >= 1000 && n <= 50_000_000)
      .slice(0, options?.maxPrices ?? 20);

    if (prices.length === 0) {
      return { prices: [], avg: null, source: "naver_shop" };
    }
    const avg = Math.round(
      prices.reduce((s, p) => s + p, 0) / prices.length,
    );
    return { prices, avg, source: "naver_shop" };
  } catch {
    return { prices: [], avg: null, source: "unavailable" };
  }
}
