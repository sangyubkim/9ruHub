import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  activeRecommendationWhere,
  ignoredRecommendationWhere,
} from "@/lib/recommend/filters";
import { getDefaultTenantId } from "@/lib/tenant";
import { DiscoverKeywordForm } from "@/app/recommendations/DiscoverKeywordForm";
import { RecommendActions } from "@/app/recommendations/RecommendActions";
import { RecommendGenerateForm } from "@/app/recommendations/RecommendGenerateForm";

export const dynamic = "force-dynamic";

function featureNumber(
  breakdown: unknown,
  key: string,
): number | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  if (!features) return null;
  const value = features[key];
  return typeof value === "number" ? value : null;
}

type PageProps = {
  searchParams?: Promise<{ ignored?: string }>;
};

export default async function RecommendationsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const showIgnored =
    params.ignored === "1" || params.ignored === "true";

  const tenantId = await getDefaultTenantId();
  const [items, ignoredCount] = await Promise.all([
    prisma.aiRecommendation.findMany({
      where: showIgnored
        ? ignoredRecommendationWhere(tenantId)
        : activeRecommendationWhere(tenantId),
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      include: {
        draft: { select: { id: true, status: true } },
        product: { select: { id: true, salePriceKrw: true, sourcePrice: true } },
        candidate: {
          select: {
            id: true,
            keyword: true,
            searchVolume: true,
            competition: true,
            marginRate: true,
            costPrice: true,
            sellPrice: true,
            rating: true,
            reviewCount: true,
            isStub: true,
            sourceDemandMall: true,
            sourceSupplyMall: true,
          },
        },
      },
      take: 100,
    }),
    prisma.aiRecommendation.count({
      where: ignoredRecommendationWhere(tenantId),
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          AI 상품 발굴 · 추천
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          ① 네이버 키워드 ↔ 1688 원가로 후보를 만들고 규칙 점수를 매깁니다. GPT는
          이유 문구만 담당합니다(키 없으면 템플릿). 원클릭으로 초안을 만든 뒤
          승인·등록 흐름으로 이어집니다.
        </p>
      </section>

      <DiscoverKeywordForm />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-700">Amazon URL / 기존 스캔</h3>
        <RecommendGenerateForm />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-700">
            {showIgnored ? "무시된 추천" : "추천 목록"}
          </h3>
          {showIgnored ? (
            <Link
              href="/recommendations"
              className="text-xs text-sky-800 underline"
            >
              활성 목록으로
            </Link>
          ) : ignoredCount > 0 ? (
            <Link
              href="/recommendations?ignored=1"
              className="text-xs text-zinc-500 underline hover:text-sky-800"
            >
              무시된 항목 보기 ({ignoredCount})
            </Link>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-sm text-zinc-500">
            {showIgnored
              ? "무시된 추천이 없습니다."
              : "추천이 없습니다. 「키워드로 발굴」하거나 Amazon URL / 기존 상품 스캔을 사용하세요."}
          </p>
        ) : (
          items.map((item) => {
            const vol =
              item.candidate?.searchVolume ??
              featureNumber(item.scoreBreakdown, "searchVolume");
            const margin =
              item.candidate?.marginRate != null
                ? Number(item.candidate.marginRate)
                : featureNumber(item.scoreBreakdown, "marginRate");
            const cost =
              item.candidate?.costPrice != null
                ? Number(item.candidate.costPrice)
                : featureNumber(item.scoreBreakdown, "costPriceCny");
            const sell =
              item.candidate?.sellPrice ??
              featureNumber(item.scoreBreakdown, "sellPriceKrw");

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-sky-800">
                      {item.reasonCode ?? "—"} · {Number(item.score).toFixed(1)}점
                      {item.candidate
                        ? ` · ${item.candidate.sourceDemandMall}↔${item.candidate.sourceSupplyMall}`
                        : ""}
                      {item.candidate?.isStub ? " · STUB" : ""}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                    {item.candidate?.keyword ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        키워드: {item.candidate.keyword}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-600">{item.reasonText}</p>
                    {(vol != null || margin != null || cost != null) && (
                      <p className="mt-2 text-xs text-zinc-500">
                        {vol != null
                          ? `검색량 ${vol.toLocaleString("ko-KR")}`
                          : null}
                        {margin != null
                          ? ` · 마진 ${(margin * 100).toFixed(1)}%`
                          : null}
                        {cost != null ? ` · ¥${cost}` : null}
                        {sell != null
                          ? ` → ${sell.toLocaleString("ko-KR")}원`
                          : null}
                      </p>
                    )}
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-sky-800 underline"
                      >
                        원본 보기
                      </a>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <p>상태: {item.status}</p>
                    {item.draftId ? (
                      <Link
                        href={`/drafts/${item.draftId}`}
                        className="mt-1 inline-block text-sky-800 underline"
                      >
                        초안 열기
                      </Link>
                    ) : null}
                  </div>
                </div>
                <RecommendActions
                  id={item.id}
                  status={item.status}
                  draftId={item.draftId}
                />
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
