import {
  classifyCompetitorMatch,
  type CompetitorMatchKind,
} from "@/lib/discover/demand/competitor-match";
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
  /** same_likely = 모델·브랜드 토큰 겹침 추정 (ASIN 확정 아님) */
  matchKind: CompetitorMatchKind;
  matchLabel: string;
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** 부품·소모품·액세서리 — 본품 시세에서 제외 */
const ACCESSORY_TITLE_RE =
  /부품|교체용|교체\s*키트|호환\s*부품|소모품|액세서리|악세사리|리필|전용\s*날|칼날만|필터만|뚜껑만|커버만|거치대만|케이스만|마개만|패킹만|실리콘\s*패킹|spare\s*parts?|replacement\s*(blade|part|filter)|accessories?/i;

export function isLikelyAccessoryTitle(title: string): boolean {
  return ACCESSORY_TITLE_RE.test(title);
}

export function medianPriceKrw(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** 중간값 대비 지나치게 싼/비싼 이상치 제거 (본품 밴드 유지) */
export function filterPriceOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const med = medianPriceKrw(prices);
  if (med == null || med <= 0) return prices;
  const lo = med * 0.4;
  const hi = med * 2.5;
  const kept = prices.filter((p) => p >= lo && p <= hi);
  return kept.length >= 3 ? kept : prices;
}

export type CompetitorMarketStats = {
  prices: number[];
  avg: number | null;
  samples: CompetitorSample[];
  uniqueMallCount: number;
  sameLikelyCount: number;
};

export function samplesFromNaverShopItems(
  items: NaverShopItem[],
  options?: {
    maxPrices?: number;
    maxSamples?: number;
    sourceTitle?: string;
    sourceBrand?: string | null;
    /** 검색 키워드 — 제목에 핵심 토큰이 없으면 제외(선택) */
    keyword?: string;
  },
): CompetitorMarketStats {
  const maxPrices = options?.maxPrices ?? 20;
  const maxSamples = options?.maxSamples ?? 5;
  const sourceTitle = options?.sourceTitle?.trim() ?? "";
  const keywordTokens = (options?.keyword ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 4);

  const priced = items
    .map((item) => {
      const priceKrw = Number(item.lprice);
      if (!Number.isFinite(priceKrw) || priceKrw < 1000 || priceKrw > 50_000_000) {
        return null;
      }
      if (!item.link?.startsWith("http")) return null;
      const title = stripHtml(item.title) || "네이버 상품";
      if (isLikelyAccessoryTitle(title)) return null;

      // 키워드 토큰이 있으면 제목에 하나 이상 포함 (영·한 혼용 검색 완화)
      if (keywordTokens.length > 0) {
        const titleLower = title.toLowerCase();
        const hit = keywordTokens.some((t) => titleLower.includes(t));
        if (!hit) return null;
      }

      const match = sourceTitle
        ? classifyCompetitorMatch({
            sourceTitle,
            sourceBrand: options?.sourceBrand,
            competitorTitle: title,
          })
        : { kind: "similar" as const, label: "유사" };
      return {
        title,
        link: item.link,
        priceKrw,
        mallName: item.mallName?.trim() || "쇼핑몰",
        matchKind: match.kind,
        matchLabel: match.label,
      } satisfies CompetitorSample;
    })
    .filter((x): x is CompetitorSample => x != null);

  if (priced.length === 0) {
    return {
      prices: [],
      avg: null,
      samples: [],
      uniqueMallCount: 0,
      sameLikelyCount: 0,
    };
  }

  // 동일 추정 충분하면 그 풀만 사용 (본품·동일 모델 시세)
  const sameLikely = priced.filter((p) => p.matchKind === "same_likely");
  const pool = sameLikely.length >= 3 ? sameLikely : priced;

  const band = filterPriceOutliers(pool.map((p) => p.priceKrw)).slice(
    0,
    maxPrices,
  );
  const bandSet = new Set(band);
  const inBand = pool.filter((p) => bandSet.has(p.priceKrw)).slice(0, maxPrices);

  // 시세 = 중간값 (최저가 잡화에 덜 끌림)
  const avg = medianPriceKrw(band);

  const samples = [...inBand]
    .sort((a, b) => {
      if (a.matchKind === b.matchKind) return a.priceKrw - b.priceKrw;
      return a.matchKind === "same_likely" ? -1 : 1;
    })
    .slice(0, maxSamples);

  const uniqueMallCount = new Set(
    priced.map((p) => p.mallName.trim().toLowerCase()).filter(Boolean),
  ).size;

  return {
    prices: band,
    avg,
    samples,
    uniqueMallCount,
    sameLikelyCount: sameLikely.length,
  };
}

/**
 * 네이버 쇼핑 → 본품 시세에 가까운 경쟁가.
 * 관련도순 검색 + 부품 제외 + 이상치 제거 + 중간값.
 */
export async function fetchNaverCompetitorPrices(
  keyword: string,
  options?: {
    display?: number;
    maxPrices?: number;
    maxSamples?: number;
    sourceTitle?: string;
    sourceBrand?: string | null;
  },
): Promise<{
  prices: number[];
  avg: number | null;
  samples: CompetitorSample[];
  uniqueMallCount: number;
  sameLikelyCount: number;
  shopTotal: number | null;
  source: "naver_shop" | "unavailable";
  keyword: string;
}> {
  const trimmed = keyword.trim();
  if (!trimmed || !hasNaverOpenApiCredentials()) {
    return {
      prices: [],
      avg: null,
      samples: [],
      uniqueMallCount: 0,
      sameLikelyCount: 0,
      shopTotal: null,
      source: "unavailable",
      keyword: trimmed,
    };
  }

  try {
    // asc(최저가순)는 부품·잡화가 앞에 옴 → 관련도순
    const shop = await fetchNaverShopSearch(trimmed, {
      display: options?.display ?? 40,
      sort: "sim",
    });
    const parsed = samplesFromNaverShopItems(shop.items, {
      maxPrices: options?.maxPrices,
      maxSamples: options?.maxSamples,
      sourceTitle: options?.sourceTitle,
      sourceBrand: options?.sourceBrand,
      keyword: trimmed,
    });
    return {
      ...parsed,
      shopTotal: Number.isFinite(shop.total) ? shop.total : null,
      source: "naver_shop",
      keyword: trimmed,
    };
  } catch {
    return {
      prices: [],
      avg: null,
      samples: [],
      uniqueMallCount: 0,
      sameLikelyCount: 0,
      shopTotal: null,
      source: "unavailable",
      keyword: trimmed,
    };
  }
}
