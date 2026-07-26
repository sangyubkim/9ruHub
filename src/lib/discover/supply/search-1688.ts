import { SupplyMall } from "@/generated/prisma/client";
import type { SupplyOffer } from "@/lib/discover/types";
import { to1688OfferUrl } from "@/lib/discover/supply/parse-1688-url";

export type Parsed1688SearchHit = {
  offerId: string;
  title: string;
  costPriceCny: number | null;
  supplyUrl: string;
};

/**
 * 1688 검색 결과 HTML/JSON에서 offerId·제목·가격 후보를 뽑는다.
 * (JS 렌더·로그인벽이 많아 best-effort)
 */
export function parse1688SearchHtml(
  html: string,
  limit = 10,
): Parsed1688SearchHit[] {
  const byId = new Map<string, Parsed1688SearchHit>();

  // detail.1688.com/offer/{id}.html
  const urlRe = /detail\.1688\.com\/offer\/(\d{6,})\.html/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(html)) != null) {
    const offerId = m[1]!;
    if (!byId.has(offerId)) {
      byId.set(offerId, {
        offerId,
        title: `1688 offer ${offerId}`,
        costPriceCny: null,
        supplyUrl: to1688OfferUrl(offerId),
      });
    }
    if (byId.size >= limit * 4) break;
  }

  // JSON offerId / informationId
  const idRe = /"(?:offerId|informationId|offer_id)"\s*:\s*"?(?<id>\d{6,})"?/gi;
  while ((m = idRe.exec(html)) != null) {
    const offerId = m.groups?.id ?? m[1]!;
    if (!byId.has(offerId)) {
      byId.set(offerId, {
        offerId,
        title: `1688 offer ${offerId}`,
        costPriceCny: null,
        supplyUrl: to1688OfferUrl(offerId),
      });
    }
  }

  // subject / title near offerId blocks (loose)
  const subjectBlocks = html.matchAll(
    /"offerId"\s*:\s*"?(?<id>\d{6,})"?[\s\S]{0,400}?"(?:subject|title|offerTitle)"\s*:\s*"(?<t>[^"]{2,200})"/gi,
  );
  for (const block of subjectBlocks) {
    const offerId = block.groups?.id;
    const title = decodeJsonString(block.groups?.t ?? "");
    if (!offerId || !title) continue;
    const prev = byId.get(offerId);
    if (prev) prev.title = title.slice(0, 200);
    else {
      byId.set(offerId, {
        offerId,
        title: title.slice(0, 200),
        costPriceCny: null,
        supplyUrl: to1688OfferUrl(offerId),
      });
    }
  }

  // price near offerId (JSON "price":"23.5" / nested priceInfo)
  const priceBlocks = html.matchAll(
    /"offerId"\s*:\s*"?(?<id>\d{6,})"?[\s\S]{0,500}?"(?:price|discountPrice|offerPrice|minPrice)"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
  );
  for (const block of priceBlocks) {
    const offerId = block.groups?.id;
    const price = Number(block.groups?.p);
    if (!offerId || !Number.isFinite(price) || price <= 0) continue;
    const hit = byId.get(offerId);
    if (hit && hit.costPriceCny == null) {
      hit.costPriceCny = round2(price);
    }
  }

  const priceInfoBlocks = html.matchAll(
    /"offerId"\s*:\s*"?(?<id>\d{6,})"?[\s\S]{0,600}?"priceInfo"\s*:\s*\{[^}]{0,200}"price"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
  );
  for (const block of priceInfoBlocks) {
    const offerId = block.groups?.id;
    const price = Number(block.groups?.p);
    if (!offerId || !Number.isFinite(price) || price <= 0) continue;
    const hit = byId.get(offerId);
    if (hit && hit.costPriceCny == null) {
      hit.costPriceCny = round2(price);
    }
  }

  // ¥ price next to offer links (fallback)
  const yenNear = html.matchAll(
    /offer\/(\d{6,})\.html[\s\S]{0,180}?¥\s*(\d+(?:\.\d+)?)/gi,
  );
  for (const block of yenNear) {
    const offerId = block[1]!;
    const price = Number(block[2]);
    const hit = byId.get(offerId);
    if (hit && hit.costPriceCny == null && Number.isFinite(price) && price > 0) {
      hit.costPriceCny = round2(price);
    }
  }

  return [...byId.values()].slice(0, Math.max(1, limit));
}

export function build1688SearchUrl(keyword: string): string {
  const q = encodeURIComponent(keyword.trim());
  return `https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`;
}

/** 모바일 검색 (PC가 SPA/로그인벽일 때 보조) */
export function build1688MobileSearchUrl(keyword: string): string {
  const q = encodeURIComponent(keyword.trim());
  return `https://m.1688.com/offer_search/-.html?keywords=${q}`;
}

/** 알리 안티봇·로그인 점프 페이지 */
export function is1688LoginWallHtml(html: string): boolean {
  return /_____tmd_____|login_jump|login\.1688\.com|login\.taobao\.com|punish|deny_pc|安全验证|滑动验证/i.test(
    html,
  );
}

/**
 * 1688 키워드 검색 → SupplyOffer[]
 * 순서: JSON API → HTML fetch → Playwright(브라우저) → (호출부에서 stub)
 */
export async function search1688Offers(
  keyword: string,
  options?: {
    limit?: number;
    enrichLimit?: number;
    fetchImpl?: typeof fetch;
    /** false면 Playwright 생략 */
    useBrowser?: boolean;
  },
): Promise<{
  offers: SupplyOffer[];
  searchUrl: string;
  hitCount: number;
  enriched: number;
  fetchError?: string;
  source?: "api" | "html" | "playwright";
}> {
  const limit = Math.min(Math.max(options?.limit ?? 3, 1), 10);
  const enrichLimit = Math.min(
    Math.max(options?.enrichLimit ?? limit, 0),
    limit,
  );
  const fetchImpl = options?.fetchImpl ?? fetch;
  const trimmed = keyword.trim();
  if (!trimmed) {
    return { offers: [], searchUrl: "", hitCount: 0, enriched: 0 };
  }

  let hits: Parsed1688SearchHit[] = [];
  let searchUrl = build1688SearchUrl(trimmed);
  let lastError = "no_offers_parsed";
  let source: "api" | "html" | "playwright" | undefined;

  try {
    // 1) 내부 JSON API
    const { fetch1688MarketOfferApi } = await import(
      "@/lib/discover/supply/search-1688-api"
    );
    const api = await fetch1688MarketOfferApi(trimmed, {
      limit: limit * 2,
      fetchImpl,
    });
    if (api.hits.length > 0) {
      hits = api.hits;
      searchUrl = api.searchUrl;
      source = "api";
    } else {
      lastError = api.fetchError ?? lastError;
    }

    // 2) HTML fetch (PC → 모바일)
    if (hits.length === 0) {
      const searchUrls = [
        build1688SearchUrl(trimmed),
        build1688MobileSearchUrl(trimmed),
      ];
      for (const url of searchUrls) {
        searchUrl = url;
        const res = await fetchImpl(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9,ko;q=0.8,en;q=0.7",
            Accept: "text/html,application/xhtml+xml",
            Referer: "https://www.1688.com/",
          },
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
          redirect: "follow",
        });

        if (!res.ok) {
          lastError = `http_${res.status}`;
          continue;
        }

        const html = await res.text();
        if (is1688LoginWallHtml(html)) {
          lastError = "needs_login_session";
          continue;
        }
        if (
          /验证|登录|login|captcha|security/i.test(html) &&
          html.length < 5000
        ) {
          lastError = "blocked_or_login_wall";
          continue;
        }

        const previewHits = parse1688SearchHtml(html, limit * 2);
        if (previewHits.length > 0) {
          hits = previewHits;
          source = "html";
          break;
        }
        lastError = "no_offers_parsed";
      }
    }

    // 3) Playwright 브라우저
    const allowBrowser =
      options?.useBrowser ??
      (await import("@/lib/discover/supply/search-1688-browser")).shouldUse1688Browser();
    if (hits.length === 0 && allowBrowser) {
      const { fetch1688SearchHtmlViaBrowser } = await import(
        "@/lib/discover/supply/search-1688-browser"
      );
      const browser = await fetch1688SearchHtmlViaBrowser(trimmed, {
        limit: limit * 2,
      });
      if (browser.hits.length > 0) {
        hits = browser.hits;
        searchUrl = browser.searchUrl;
        source = "playwright";
      } else {
        lastError = browser.fetchError ?? lastError;
      }
    }

    if (hits.length === 0) {
      return {
        offers: [],
        searchUrl,
        hitCount: 0,
        enriched: 0,
        fetchError: lastError,
      };
    }

    const { fetch1688Offer } = await import(
      "@/lib/discover/supply/fetch-1688-offer"
    );

    const offers: SupplyOffer[] = [];
    let enriched = 0;

    for (const hit of hits) {
      if (offers.length >= limit) break;

      let cost = hit.costPriceCny;
      let title = hit.title;
      let weightGrams: number | null = null;
      let usedDetail = false;

      const needEnrich =
        cost == null ||
        /^1688 offer \d+$/.test(title) ||
        (offers.length < enrichLimit && cost != null);

      if (needEnrich && enriched < enrichLimit) {
        try {
          const detail = await fetch1688Offer(hit.supplyUrl, {
            titleHint: title,
            costPriceCnyOverride: cost ?? undefined,
          });
          cost = detail.costPriceCny;
          title = detail.title || title;
          weightGrams = detail.weightGrams ?? null;
          usedDetail = true;
          enriched += 1;
        } catch {
          // 검색 가격만으로 진행
        }
      }

      if (cost == null || cost <= 0) continue;

      offers.push({
        mall: SupplyMall.MALL_1688,
        title,
        supplyUrl: hit.supplyUrl,
        externalSupplyId: hit.offerId,
        costPriceCny: cost,
        weightGrams,
        isStub: false,
        raw: {
          provider: "mall1688-search-live",
          searchUrl,
          source: source ?? "html",
          enriched: usedDetail,
          fromSearchPrice: hit.costPriceCny,
        },
      });
    }

    return {
      offers,
      searchUrl,
      hitCount: hits.length,
      enriched,
      source,
      fetchError: offers.length === 0 ? "offers_without_price" : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      offers: [],
      searchUrl,
      hitCount: 0,
      enriched: 0,
      fetchError: message,
    };
  }
}

function decodeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return s
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCharCode(Number.parseInt(h, 16)),
      )
      .replace(/\\n/g, " ")
      .trim();
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
