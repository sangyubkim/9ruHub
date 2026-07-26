import {
  fetchNaverKeywordHints,
  hasNaverSearchAdCredentials,
} from "@/lib/discover/demand/naver-searchad-api";
import { uniqKeywords } from "@/lib/discover/seed-keywords";

/**
 * 검색광고 연관키워드로 시드를 확장한다.
 * 자격 증명 없거나 실패 시 빈 배열(시드만 쓰는 쪽으로 폴백).
 */
export async function expandRelatedKeywords(
  seedKeywords: string[],
  options?: {
    maxPerSeed?: number;
    maxTotal?: number;
    delayMs?: number;
  },
): Promise<{
  related: string[];
  errors: Array<{ keyword: string; error: string }>;
}> {
  if (!hasNaverSearchAdCredentials()) {
    return { related: [], errors: [] };
  }

  const maxPerSeed = options?.maxPerSeed ?? 3;
  const maxTotal = options?.maxTotal ?? 40;
  const delayMs = options?.delayMs ?? 250;
  const seedSet = new Set(
    seedKeywords.map((k) => k.trim().toLowerCase().replace(/\s+/g, "")),
  );
  const related: string[] = [];
  const errors: Array<{ keyword: string; error: string }> = [];

  for (const seed of seedKeywords) {
    if (related.length >= maxTotal) break;
    try {
      const hints = await fetchNaverKeywordHints(seed);
      let added = 0;
      for (const hint of hints) {
        if (added >= maxPerSeed || related.length >= maxTotal) break;
        const kw = hint.relKeyword?.trim();
        if (!kw) continue;
        const norm = kw.toLowerCase().replace(/\s+/g, "");
        if (seedSet.has(norm)) continue;
        if (related.some((r) => r.toLowerCase().replace(/\s+/g, "") === norm)) {
          continue;
        }
        // 검색량 너무 낮은 연관어는 스킵
        const vol = hint.monthlyPcQcCnt + hint.monthlyMobileQcCnt;
        if (vol > 0 && vol < 100) continue;
        related.push(kw);
        added += 1;
      }
    } catch (err) {
      errors.push({
        keyword: seed,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { related: uniqKeywords(related), errors };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
