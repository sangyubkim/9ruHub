import Link from "next/link";
import { prisma } from "@/lib/db";
import { show1688Ui } from "@/lib/features";
import { build1688SearchUrl } from "@/lib/discover/supply/search-1688";
import {
  is1688OfferUrl,
  isFake1688StubDetailUrl,
} from "@/lib/discover/supply/parse-1688-url";
import {
  activeRecommendationWhere,
  ignoredRecommendationWhere,
} from "@/lib/recommend/filters";
import { getDefaultTenantId } from "@/lib/tenant";
import { Attach1688CostForm } from "@/app/recommendations/Attach1688CostForm";
import { DiscoverKeywordForm } from "@/app/recommendations/DiscoverKeywordForm";
import { FreshScanBadge } from "@/app/recommendations/FreshScanBadge";
import { RecommendActions } from "@/app/recommendations/RecommendActions";
import { RecommendCleanupBar } from "@/app/recommendations/RecommendCleanupBar";
import { RecommendEconomics } from "@/app/recommendations/RecommendEconomics";
import { RecommendGenerateForm } from "@/app/recommendations/RecommendGenerateForm";
import { WeeklyDiscoverForm } from "@/app/recommendations/WeeklyDiscoverForm";

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

function readMarketVerdict(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const v = (breakdown as { marketVerdict?: Record<string, unknown> })
    .marketVerdict;
  if (!v || typeof v.code !== "string") return null;
  return {
    code: v.code,
    label: typeof v.label === "string" ? v.label : v.code,
    message: typeof v.message === "string" ? v.message : "",
    competitorAvgKrw:
      typeof v.competitorAvgKrw === "number" ? v.competitorAvgKrw : null,
    marketCeilingKrw:
      typeof v.marketCeilingKrw === "number" ? v.marketCeilingKrw : null,
    minViableSaleKrw:
      typeof v.minViableSaleKrw === "number" ? v.minViableSaleKrw : undefined,
    consolidatedMinViableKrw:
      typeof v.consolidatedMinViableKrw === "number"
        ? v.consolidatedMinViableKrw
        : null,
    consolidationUnits:
      typeof v.consolidationUnits === "number"
        ? v.consolidationUnits
        : undefined,
  };
}

type PageProps = {
  searchParams?: Promise<{ ignored?: string }>;
};

export default async function RecommendationsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const showIgnored =
    params.ignored === "1" || params.ignored === "true";
  const chinaUi = show1688Ui();

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
            supplyUrl: true,
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
          주력은 Amazon US URL 소싱입니다. 상품 링크를 넣으면 원가·몰테일
          국제배송·판매가를 추천합니다.
          {chinaUi
            ? " 네이버↔1688 발굴은 아래 레거시 섹션에서 사용할 수 있습니다."
            : " 중국(1688) UI는 기본 비활성입니다."}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-700">
          Amazon URL / 기존 스캔
        </h3>
        <p className="text-xs text-zinc-500">
          amazon.com 상품 URL 또는 ASIN → 추천 카드 · 초안 연결
        </p>
        <RecommendGenerateForm />
      </section>

      {chinaUi ? (
        <section className="space-y-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-600">
            레거시 · 네이버↔1688 발굴
          </h3>
          <WeeklyDiscoverForm />
          <DiscoverKeywordForm />
        </section>
      ) : null}

      <section className="space-y-3">
        <RecommendCleanupBar
          activeCount={showIgnored ? 0 : items.length}
          ignoredCount={ignoredCount}
        />
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
              : "추천이 없습니다. Amazon URL을 넣거나 기존 상품 스캔을 사용하세요."}
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
              featureNumber(item.scoreBreakdown, "sellPriceKrw") ??
              item.candidate?.sellPrice;
            const minViable = featureNumber(
              item.scoreBreakdown,
              "minViableSaleKrw",
            );
            const competitorAvg = featureNumber(
              item.scoreBreakdown,
              "competitorAvgKrw",
            );
            const sourceCostKrw = featureNumber(
              item.scoreBreakdown,
              "sourceCostKrw",
            );
            const intlShippingKrw = featureNumber(
              item.scoreBreakdown,
              "intlShippingKrw",
            );
            const marketVerdict = readMarketVerdict(item.scoreBreakdown);

            const candidateUrl =
              item.candidate?.supplyUrl ?? item.sourceUrl ?? null;
            const realOfferUrl =
              candidateUrl &&
              is1688OfferUrl(candidateUrl) &&
              !isFake1688StubDetailUrl(candidateUrl)
                ? candidateUrl
                : null;
            const isStubCard = Boolean(item.candidate?.isStub);
            const searchHref =
              chinaUi && item.candidate?.keyword != null
                ? build1688SearchUrl(item.candidate.keyword)
                : chinaUi &&
                    candidateUrl &&
                    !isFake1688StubDetailUrl(candidateUrl) &&
                    candidateUrl.includes("1688.com")
                  ? candidateUrl
                  : null;
            const amazonOrOtherUrl =
              item.sourceUrl &&
              !isFake1688StubDetailUrl(item.sourceUrl) &&
              !item.sourceUrl.includes("1688.com")
                ? item.sourceUrl
                : candidateUrl &&
                    !isFake1688StubDetailUrl(candidateUrl) &&
                    !candidateUrl.includes("1688.com")
                  ? candidateUrl
                  : null;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.candidate && chinaUi ? (
                        <p className="text-xs text-zinc-500">
                          {item.candidate.sourceDemandMall}↔
                          {item.candidate.sourceSupplyMall}
                        </p>
                      ) : null}
                      <FreshScanBadge recommendationId={item.id} />
                    </div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    {item.candidate?.keyword ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        키워드: {item.candidate.keyword}
                      </p>
                    ) : null}
                    <RecommendEconomics
                      score={Number(item.score)}
                      reasonCode={item.reasonCode}
                      isStub={isStubCard}
                      costCny={cost}
                      sellKrw={sell}
                      minViableKrw={minViable}
                      competitorAvgKrw={competitorAvg}
                      sourceCostKrw={sourceCostKrw}
                      intlShippingKrw={intlShippingKrw}
                      marginRate={margin}
                      searchVolume={vol}
                      marketVerdict={marketVerdict}
                    />
                    {item.reasonText ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        {item.reasonText}
                      </p>
                    ) : null}
                    {amazonOrOtherUrl ? (
                      <a
                        href={amazonOrOtherUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-sky-800 underline"
                      >
                        원본 보기
                      </a>
                    ) : chinaUi && realOfferUrl ? (
                      <a
                        href={realOfferUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-sky-800 underline"
                      >
                        원본 보기
                      </a>
                    ) : chinaUi && searchHref ? (
                      <a
                        href={searchHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-sky-800 underline"
                      >
                        {isStubCard
                          ? "1688에서 검색 (스텁·실상품 아님)"
                          : "1688에서 검색"}
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
                {chinaUi &&
                item.candidateId &&
                item.status !== "IGNORED" &&
                item.status !== "CONVERTED" ? (
                  <Attach1688CostForm
                    recommendationId={item.id}
                    initialUrl={realOfferUrl ?? undefined}
                  />
                ) : null}
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
