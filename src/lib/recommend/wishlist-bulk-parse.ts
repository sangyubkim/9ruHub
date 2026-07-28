/**
 * 위시리스트 텍스트 파싱 (서버/클라이언트 공용, DB 의존 없음).
 */

import { extractAsin, toAmazonUsUrl } from "@/lib/amazon/parse-url";

export const WISHLIST_MAX_ITEMS = 10;
export const WISHLIST_DELAY_MS = 1000;

export type WishlistParsedLine = {
  raw: string;
  asin: string;
  url: string;
};

export type WishlistItemResult = {
  raw: string;
  asin: string;
  status: "created" | "skipped" | "invalid" | "error";
  recommendationId?: string;
  reason?: string;
  reasonCode?: string | null;
  isFallback?: boolean;
  sourcingFitCode?: string | null;
};

export type WishlistBulkResult = {
  tenantId: string;
  parsed: number;
  created: number;
  skipped: number;
  invalid: number;
  failed: number;
  truncated: boolean;
  results: WishlistItemResult[];
};

/**
 * 줄 단위로 ASIN/URL 파싱. 빈 줄·# 주석 무시, ASIN 기준 중복 제거(최초 유지).
 */
export function parseWishlistLines(text: string): {
  items: WishlistParsedLine[];
  invalid: WishlistItemResult[];
  truncated: boolean;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const seen = new Set<string>();
  const items: WishlistParsedLine[] = [];
  const invalid: WishlistItemResult[] = [];

  for (const raw of lines) {
    const asin = extractAsin(raw);
    if (!asin) {
      invalid.push({
        raw,
        asin: "",
        status: "invalid",
        reason: "ASIN 또는 Amazon URL이 아닙니다.",
      });
      continue;
    }
    if (seen.has(asin)) {
      invalid.push({
        raw,
        asin,
        status: "skipped",
        reason: "입력 목록에서 중복 ASIN",
      });
      continue;
    }
    seen.add(asin);
    if (items.length >= WISHLIST_MAX_ITEMS) {
      invalid.push({
        raw,
        asin,
        status: "skipped",
        reason: `한 번에 최대 ${WISHLIST_MAX_ITEMS}건까지 처리합니다.`,
      });
      continue;
    }
    items.push({ raw, asin, url: toAmazonUsUrl(asin) });
  }

  return {
    items,
    invalid,
    truncated: invalid.some((r) =>
      Boolean(r.reason?.includes(`최대 ${WISHLIST_MAX_ITEMS}`)),
    ),
  };
}
