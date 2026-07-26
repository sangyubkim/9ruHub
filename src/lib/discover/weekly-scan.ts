import { discoverDemandOnlyByKeyword } from "@/lib/discover/demand-only";
import { discoverByKeyword } from "@/lib/discover/engine";
import { expandRelatedKeywords } from "@/lib/discover/expand-keywords";
import {
  getSeedKeywords,
  listSeedCategories,
  uniqKeywords,
  type DiscoverSeedCategory,
} from "@/lib/discover/seed-keywords";
import { cleanupRecommendations } from "@/lib/recommend/cleanup";
import { getDefaultTenantId } from "@/lib/tenant";

export type WeeklySupplyMode = "demand_only" | "legacy_1688";

export type WeeklyDiscoverOptions = {
  tenantId?: string;
  /** all 또는 카테고리 코드 */
  category?: DiscoverSeedCategory | "all";
  /** 시드 개수 상한 (테스트용) */
  seedLimit?: number;
  /** 검색광고 연관키워드 확장 */
  expandRelated?: boolean;
  maxRelatedPerSeed?: number;
  maxRelatedTotal?: number;
  supplyLimit?: number;
  minScore?: number;
  /** 키워드 사이 대기(API 한도) */
  delayMs?: number;
  /**
   * demand_only(기본): 네이버 수요 → Amazon URL 대기 카드
   * legacy_1688: 기존 네이버↔1688 공급 경로
   */
  supplyMode?: WeeklySupplyMode;
  /**
   * true면 이번 스캔에 없는 기존 PENDING 발굴 추천을 무시해 목록을 교체.
   * 기본 true (누적 방지)
   */
  replacePending?: boolean;
};

export type WeeklyDiscoverKeywordResult = {
  keyword: string;
  source: "seed" | "related";
  created: number;
  isStub: boolean;
  topScore: number | null;
  topLabel: string | null;
  title: string | null;
  recommendationIds: string[];
  error?: string;
};

/**
 * 시드(+선택적 연관 확장) 키워드를 일괄 발굴해 추천 목록을 채운다.
 */
export async function runWeeklyDiscover(options?: WeeklyDiscoverOptions) {
  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const category = options?.category ?? "all";
  const expandRelated = options?.expandRelated ?? false;
  const supplyLimit = options?.supplyLimit ?? 1;
  const minScore = options?.minScore ?? 40;
  const delayMs = options?.delayMs ?? 300;
  const replacePending = options?.replacePending ?? true;
  const envMode = process.env.DISCOVER_WEEKLY_SUPPLY_MODE?.trim();
  const supplyMode: WeeklySupplyMode =
    options?.supplyMode ??
    (envMode === "legacy_1688" ? "legacy_1688" : "demand_only");
  const demandOnly = supplyMode !== "legacy_1688";

  const seeds = getSeedKeywords({
    category,
    limit: options?.seedLimit,
  });
  const seedKeywordList = seeds.map((s) => s.keyword);

  let related: string[] = [];
  let expandErrors: Array<{ keyword: string; error: string }> = [];

  if (expandRelated) {
    const expanded = await expandRelatedKeywords(seedKeywordList, {
      maxPerSeed: options?.maxRelatedPerSeed ?? 2,
      maxTotal: options?.maxRelatedTotal ?? 30,
      delayMs: Math.min(delayMs, 400),
    });
    related = expanded.related;
    expandErrors = expanded.errors;
  }

  const queue: Array<{ keyword: string; source: "seed" | "related" }> = [
    ...seedKeywordList.map((keyword) => ({
      keyword,
      source: "seed" as const,
    })),
    ...related.map((keyword) => ({ keyword, source: "related" as const })),
  ];

  // 최종 중복 제거 (시드 우선)
  const deduped = uniqKeywords(queue.map((q) => q.keyword));
  const sourceByKeyword = new Map<string, "seed" | "related">();
  for (const q of queue) {
    const key = q.keyword.trim().toLowerCase().replace(/\s+/g, "");
    if (!sourceByKeyword.has(key)) sourceByKeyword.set(key, q.source);
  }

  const results: WeeklyDiscoverKeywordResult[] = [];
  let createdTotal = 0;
  let stubCount = 0;
  let awaitingAmazonCount = 0;

  for (let i = 0; i < deduped.length; i += 1) {
    const keyword = deduped[i]!;
    const norm = keyword.toLowerCase().replace(/\s+/g, "");
    const source = sourceByKeyword.get(norm) ?? "seed";

    try {
      const result = demandOnly
        ? await discoverDemandOnlyByKeyword(keyword, { tenantId, minScore })
        : await discoverByKeyword(keyword, {
            tenantId,
            supplyLimit,
            minScore,
          });
      const top = result.items[0];
      createdTotal += result.created;
      if (result.isStub) stubCount += 1;
      if ("awaitingAmazon" in result && result.awaitingAmazon && result.created > 0) {
        awaitingAmazonCount += 1;
      }
      results.push({
        keyword,
        source,
        created: result.created,
        isStub: result.isStub,
        topScore: top?.score ?? null,
        topLabel: top?.label ?? null,
        title: top?.title ?? null,
        recommendationIds: result.items.map((it) => it.recommendationId),
      });
    } catch (err) {
      results.push({
        keyword,
        source,
        created: 0,
        isStub: true,
        topScore: null,
        topLabel: null,
        title: null,
        recommendationIds: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (delayMs > 0 && i < deduped.length - 1) {
      await sleep(delayMs);
    }
  }

  const ranked = [...results]
    .filter((r) => r.topScore != null)
    .sort((a, b) => (b.topScore ?? 0) - (a.topScore ?? 0));

  const added = results.filter((r) => r.created > 0 && !r.error);
  const failed = results.filter((r) => Boolean(r.error));
  const noHit = results.filter((r) => !r.error && r.created === 0);
  const recommendationIds = results.flatMap((r) => r.recommendationIds);

  let replacedIgnored = 0;
  if (replacePending && recommendationIds.length > 0) {
    const cleanup = await cleanupRecommendations({
      tenantId,
      mode: "pending_except_ids",
      exceptIds: recommendationIds,
      discoverOnly: true,
    });
    replacedIgnored = cleanup.ignored;
  }

  return {
    tenantId,
    category,
    expandRelated,
    replacePending,
    supplyMode: demandOnly ? "demand_only" : "legacy_1688",
    seedCount: seedKeywordList.length,
    relatedCount: related.length,
    scanned: deduped.length,
    createdTotal,
    stubCount,
    awaitingAmazonCount,
    addedCount: added.length,
    failedCount: failed.length,
    noHitCount: noHit.length,
    replacedIgnored,
    minScore,
    finishedAt: new Date().toISOString(),
    categories: listSeedCategories(),
    expandErrors,
    results,
    added,
    failed,
    noHit,
    top: ranked.slice(0, 15),
    recommendationIds,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
