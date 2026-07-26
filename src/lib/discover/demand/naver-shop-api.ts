/**
 * 네이버 오픈API 쇼핑 검색 클라이언트.
 * @see https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md
 */

export type NaverShopItem = {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
};

export type NaverShopSearchResult = {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverShopItem[];
};

export function hasNaverOpenApiCredentials(): boolean {
  return Boolean(
    process.env.NAVER_CLIENT_ID?.trim() &&
      process.env.NAVER_CLIENT_SECRET?.trim(),
  );
}

export async function fetchNaverShopSearch(
  keyword: string,
  options?: { display?: number; start?: number; sort?: "sim" | "date" | "asc" | "dsc" },
): Promise<NaverShopSearchResult> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 필요합니다.");
  }

  const display = Math.min(Math.max(options?.display ?? 40, 1), 100);
  const start = Math.min(Math.max(options?.start ?? 1, 1), 1000);
  const sort = options?.sort ?? "sim";
  const query = new URLSearchParams({
    query: keyword.trim(),
    display: String(display),
    start: String(start),
    sort,
  });

  const res = await fetch(
    `https://openapi.naver.com/v1/search/shop.json?${query}`,
    {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Naver shop API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    lastBuildDate?: string;
    total?: number;
    start?: number;
    display?: number;
    items?: NaverShopItem[];
  };

  return {
    lastBuildDate: data.lastBuildDate ?? "",
    total: Number(data.total ?? 0),
    start: Number(data.start ?? start),
    display: Number(data.display ?? display),
    items: Array.isArray(data.items) ? data.items : [],
  };
}

/** 검색 결과 총건수 → 경쟁강도 0–1 (많을수록 높음) */
export function competitionFromShopTotal(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0.15;
  // log10(1)=0 … log10(1e6)≈6 → 대략 0.1–0.95
  const raw = Math.log10(total + 1) / 6;
  return round4(Math.min(0.95, Math.max(0.1, raw)));
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
