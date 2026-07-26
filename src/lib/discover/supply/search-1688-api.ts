import {
  build1688SearchUrl,
  type Parsed1688SearchHit,
} from "@/lib/discover/supply/search-1688";
import { to1688OfferUrl } from "@/lib/discover/supply/parse-1688-url";

/**
 * 1688 내부 검색 JSON 엔드포인트 (쿠키/브라우저 없이도 간헐 성공).
 * Uni-CLI 등에서 쓰는 marketOfferResultViewService.
 */
export function build1688MarketOfferApiUrl(
  keyword: string,
  options?: { page?: number; pageSize?: number },
): string {
  const q = encodeURIComponent(keyword.trim());
  const page = options?.page ?? 1;
  const pageSize = Math.min(Math.max(options?.pageSize ?? 20, 1), 50);
  return (
    `https://search.1688.com/service/marketOfferResultViewService` +
    `?keywords=${q}&beginPage=${page}&pageSize=${pageSize}&asynType=0`
  );
}

export function parse1688MarketOfferJson(
  payload: unknown,
  limit = 10,
): Parsed1688SearchHit[] {
  const root = payload as {
    data?: { offerList?: unknown[]; offers?: unknown[] };
    offerList?: unknown[];
  };
  const list =
    root?.data?.offerList ??
    root?.data?.offers ??
    root?.offerList ??
    [];
  if (!Array.isArray(list)) return [];

  const hits: Parsed1688SearchHit[] = [];
  for (const raw of list) {
    if (hits.length >= limit) break;
    const item = raw as Record<string, unknown>;
    const offerId = extractOfferId(item);
    if (!offerId) continue;

    const title = extractTitle(item) || `1688 offer ${offerId}`;
    const costPriceCny = extractPrice(item);

    hits.push({
      offerId,
      title: title.slice(0, 200),
      costPriceCny,
      supplyUrl: to1688OfferUrl(offerId),
    });
  }
  return hits;
}

export async function fetch1688MarketOfferApi(
  keyword: string,
  options?: {
    limit?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<{
  hits: Parsed1688SearchHit[];
  searchUrl: string;
  fetchError?: string;
}> {
  const limit = options?.limit ?? 10;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const trimmed = keyword.trim();
  if (!trimmed) {
    return { hits: [], searchUrl: "", fetchError: "empty_keyword" };
  }

  const apiUrl = build1688MarketOfferApiUrl(trimmed, { pageSize: limit * 2 });
  const searchUrl = build1688SearchUrl(trimmed);

  try {
    const res = await fetchImpl(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: searchUrl,
        Origin: "https://s.1688.com",
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!res.ok) {
      return { hits: [], searchUrl: apiUrl, fetchError: `http_${res.status}` };
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // JSONP / HTML 차단 페이지
      if (/验证|登录|login|captcha/i.test(text)) {
        return {
          hits: [],
          searchUrl: apiUrl,
          fetchError: "blocked_or_login_wall",
        };
      }
      return { hits: [], searchUrl: apiUrl, fetchError: "invalid_json" };
    }

    const hits = parse1688MarketOfferJson(json, limit);
    return {
      hits,
      searchUrl: apiUrl,
      fetchError: hits.length === 0 ? "no_offers_parsed" : undefined,
    };
  } catch (err) {
    return {
      hits: [],
      searchUrl: apiUrl,
      fetchError: err instanceof Error ? err.message : String(err),
    };
  }
}

function extractOfferId(item: Record<string, unknown>): string | null {
  const candidates = [
    item.offerId,
    item.id,
    (item.information as Record<string, unknown> | undefined)?.offerId,
    (item.information as Record<string, unknown> | undefined)?.id,
    (item.info as Record<string, unknown> | undefined)?.offerId,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c);
    if (/^\d{6,}$/.test(s)) return s;
  }
  // detail URL 안에 있을 수 있음
  const url =
    (item.detailUrl as string | undefined) ??
    (item.offerDetailUrl as string | undefined) ??
    "";
  const m = String(url).match(/offer\/(\d{6,})\.html/);
  return m?.[1] ?? null;
}

function extractTitle(item: Record<string, unknown>): string | null {
  const info = item.information as Record<string, unknown> | undefined;
  const t =
    info?.subject ??
    info?.title ??
    item.subject ??
    item.title ??
    item.offerTitle;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function extractPrice(item: Record<string, unknown>): number | null {
  const trade = item.tradePrice as Record<string, unknown> | undefined;
  const offerPrice = trade?.offerPrice as Record<string, unknown> | undefined;
  const raw =
    offerPrice?.valueString ??
    offerPrice?.price ??
    offerPrice?.value ??
    trade?.price ??
    item.price ??
    item.discountPrice;

  if (typeof raw === "number" && raw > 0) return round2(raw);
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) return round2(n);
  }
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
