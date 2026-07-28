/**
 * 위시리스트형 다건 ASIN/Amazon URL → 추천 생성 + 배송 적합성(best-effort).
 * createRecommendationFromUrl을 재사용하며 순차·상한으로 rate-limit.
 */

import { RecommendationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createRecommendationFromUrl } from "@/lib/recommend/engine";
import { getDefaultTenantId } from "@/lib/tenant";
import {
  parseWishlistLines,
  WISHLIST_DELAY_MS,
  WISHLIST_MAX_ITEMS,
  type WishlistBulkResult,
  type WishlistItemResult,
} from "@/lib/recommend/wishlist-bulk-parse";

export {
  parseWishlistLines,
  WISHLIST_DELAY_MS,
  WISHLIST_MAX_ITEMS,
  type WishlistBulkResult,
  type WishlistItemResult,
  type WishlistParsedLine,
} from "@/lib/recommend/wishlist-bulk-parse";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSourcingFitFromBreakdown(
  scoreBreakdown: unknown,
): string | null {
  if (!scoreBreakdown || typeof scoreBreakdown !== "object") return null;
  const features = (scoreBreakdown as { features?: Record<string, unknown> })
    .features;
  if (!features) return null;
  const fromRoot = features.sourcingFit;
  const fromPv =
    features.productViability && typeof features.productViability === "object"
      ? (features.productViability as { sourcingFit?: unknown }).sourcingFit
      : null;
  const v = fromRoot ?? fromPv;
  if (!v || typeof v !== "object") return null;
  const code = (v as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * 위시리스트 텍스트를 순차 처리해 추천을 만든다.
 * - 이미 활성 추천(동일 ASIN)이 있으면 skip
 * - 상품 fetch + ship eligibility는 createRecommendationFromUrl에 위임
 */
export async function createRecommendationsFromWishlist(
  text: string,
  options?: {
    tenantId?: string;
    delayMs?: number;
    maxItems?: number;
  },
): Promise<WishlistBulkResult> {
  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const delayMs = options?.delayMs ?? WISHLIST_DELAY_MS;
  const { items, invalid, truncated } = parseWishlistLines(text);

  const maxItems = options?.maxItems ?? WISHLIST_MAX_ITEMS;
  const queue = items.slice(0, maxItems);

  const results: WishlistItemResult[] = [...invalid];
  let created = 0;
  let skipped = invalid.filter((r) => r.status === "skipped").length;
  let failed = 0;
  const invalidCount = invalid.filter((r) => r.status === "invalid").length;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]!;
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    const existing = await prisma.aiRecommendation.findFirst({
      where: {
        tenantId,
        externalId: item.asin,
        status: {
          in: [
            RecommendationStatus.PENDING,
            RecommendationStatus.ACCEPTED,
            RecommendationStatus.DRAFT_CREATED,
          ],
        },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      results.push({
        raw: item.raw,
        asin: item.asin,
        status: "skipped",
        recommendationId: existing.id,
        reason: "이미 활성 추천이 있습니다.",
      });
      continue;
    }

    try {
      const row = await createRecommendationFromUrl(item.url, tenantId);
      created += 1;
      results.push({
        raw: item.raw,
        asin: item.asin,
        status: "created",
        recommendationId: row.id,
        reasonCode: row.reasonCode,
        isFallback: row.reasonCode === "FALLBACK",
        sourcingFitCode: readSourcingFitFromBreakdown(row.scoreBreakdown),
      });
    } catch (err) {
      failed += 1;
      results.push({
        raw: item.raw,
        asin: item.asin,
        status: "error",
        reason: err instanceof Error ? err.message : "생성 실패",
      });
    }
  }

  return {
    tenantId,
    parsed: queue.length,
    created,
    skipped,
    invalid: invalidCount,
    failed,
    truncated,
    results,
  };
}
