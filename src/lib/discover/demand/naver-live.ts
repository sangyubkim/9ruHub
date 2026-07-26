import { DemandMall } from "@/generated/prisma/client";
import { NaverDemandStubAdapter } from "@/lib/discover/demand/naver-stub";
import {
  competitionFromCompIdx,
  fetchNaverKeywordHints,
  hasNaverSearchAdCredentials,
  pickSearchVolume,
} from "@/lib/discover/demand/naver-searchad-api";
import {
  competitionFromShopTotal,
  fetchNaverShopSearch,
  hasNaverOpenApiCredentials,
} from "@/lib/discover/demand/naver-shop-api";
import type { DemandMallAdapter, DemandMetrics } from "@/lib/discover/types";

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function seasonalityByMonth(date = new Date()): number {
  // 단순 월별 가중 (여름가전·연말 성수 약간 상향)
  const m = date.getMonth() + 1;
  const map: Record<number, number> = {
    1: 55,
    2: 50,
    3: 55,
    4: 60,
    5: 65,
    6: 75,
    7: 80,
    8: 75,
    9: 60,
    10: 55,
    11: 65,
    12: 70,
  };
  return map[m] ?? 55;
}

/**
 * 네이버 실데이터 수요 어댑터.
 * - 쇼핑검색: 경쟁(결과 수)·대표 상품
 * - 검색광고(선택): 월간 검색량·경쟁지수
 * - 리뷰/평점: 쇼핑 API에 없어 중성값 + raw 표기
 */
export class NaverDemandLiveAdapter implements DemandMallAdapter {
  readonly name = "naver-demand-live";
  readonly mall = DemandMall.NAVER;

  async fetchDemand(keyword: string): Promise<DemandMetrics> {
    const trimmed = keyword.trim();
    if (!trimmed) throw new Error("keyword가 필요합니다.");

    if (!hasNaverOpenApiCredentials()) {
      console.warn(
        "[discover] NAVER_CLIENT_ID/SECRET 없음 → stub demand 폴백",
      );
      return new NaverDemandStubAdapter().fetchDemand(trimmed);
    }

    try {
      const shop = await fetchNaverShopSearch(trimmed, { display: 40 });
      let searchVolume = Math.min(50_000, Math.max(100, Math.round(shop.total / 80)));
      let competition = competitionFromShopTotal(shop.total);
      let volumeSource: "searchad" | "shop_total_proxy" = "shop_total_proxy";
      let matchedKeyword: string | null = null;
      let searchAdCompIdx: string | undefined;
      let searchAdError: string | null = null;

      if (hasNaverSearchAdCredentials()) {
        try {
          const hints = await fetchNaverKeywordHints(trimmed);
          const picked = pickSearchVolume(trimmed, hints);
          if (picked.searchVolume > 0) {
            searchVolume = picked.searchVolume;
            matchedKeyword = picked.matchedKeyword;
            volumeSource = "searchad";
          }
          const hintRow =
            hints.find((h) => h.relKeyword === matchedKeyword) ?? hints[0];
          searchAdCompIdx = hintRow?.compIdx;
          const fromComp = competitionFromCompIdx(searchAdCompIdx);
          if (fromComp != null) {
            // 쇼핑 total 경쟁과 검색광고 경쟁지수를 평균
            competition = round4((competition + fromComp) / 2);
          }
        } catch (err) {
          searchAdError = err instanceof Error ? err.message : String(err);
          console.warn("[discover] SearchAd 실패, 쇼핑 추정 검색량 사용:", searchAdError);
        }
      }

      const top = shop.items[0];
      const title = top
        ? stripHtml(top.title)
        : `[네이버] ${trimmed}`;

      // 쇼핑 검색 API는 리뷰/평점을 주지 않음 → 중성값 (점수 왜곡 최소화)
      const reviewCount = 0;
      const rating = 4.0;
      const salesEstimate = Math.round(searchVolume * 0.03);
      const seasonalityScore = seasonalityByMonth();

      return {
        mall: DemandMall.NAVER,
        keyword: trimmed,
        title,
        demandUrl: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(trimmed)}`,
        externalDemandId: top?.productId
          ? `naver-product-${top.productId}`
          : `naver-kw-${Buffer.from(trimmed).toString("base64url").slice(0, 24)}`,
        searchVolume,
        competition,
        reviewCount,
        rating,
        salesEstimate,
        seasonalityScore,
        isStub: false,
        raw: {
          provider: this.name,
          volumeSource,
          matchedKeyword,
          shopTotal: shop.total,
          shopDisplay: shop.display,
          topMall: top?.mallName ?? null,
          topLprice: top ? Number(top.lprice) || null : null,
          searchAdCompIdx: searchAdCompIdx ?? null,
          searchAdError,
          note:
            "review/rating not in Naver Shopping Search API — neutral defaults",
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[discover] Naver live 실패 → stub 폴백:", message);
      const stub = await new NaverDemandStubAdapter().fetchDemand(trimmed);
      return {
        ...stub,
        raw: {
          ...(stub.raw ?? {}),
          liveError: message,
          fallbackFrom: this.name,
        },
      };
    }
  }
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function shouldUseNaverLiveDemand(): boolean {
  const mode = (process.env.DISCOVER_NAVER_MODE ?? "auto").toLowerCase();
  if (mode === "stub" || mode === "demo") return false;
  if (mode === "live") return hasNaverOpenApiCredentials();
  // auto: 키가 있으면 live
  return hasNaverOpenApiCredentials();
}
