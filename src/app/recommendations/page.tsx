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
  amazonFacingRecommendationWhere,
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
  const root = breakdown as {
    marketVerdict?: Record<string, unknown>;
    features?: Record<string, unknown>;
  };
  const v = root.marketVerdict;
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

function featureBool(breakdown: unknown, key: string): boolean {
  if (!breakdown || typeof breakdown !== "object") return false;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  return features?.[key] === true;
}

function readShipping(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const s = features?.shipping;
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  if (typeof o.feeKrw !== "number" || typeof o.weightGrams !== "number") {
    return null;
  }
  return {
    feeKrw: o.feeKrw,
    weightGrams: o.weightGrams,
    billableLbs: typeof o.billableLbs === "number" ? o.billableLbs : null,
    totalUsd: typeof o.totalUsd === "number" ? o.totalUsd : null,
    provider: typeof o.provider === "string" ? o.provider : "?",
    tier: typeof o.tier === "string" ? o.tier : "n/a",
    note: typeof o.note === "string" ? o.note : null,
    weightSource:
      typeof o.weightSource === "string" ? o.weightSource : "default",
  };
}

function readCompetitorSamples(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return [];
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const raw = features?.competitorSamples;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      if (
        typeof o.title !== "string" ||
        typeof o.link !== "string" ||
        typeof o.priceKrw !== "number"
      ) {
        return null;
      }
      const matchKind =
        o.matchKind === "same_likely" || o.matchKind === "similar"
          ? o.matchKind
          : "similar";
      return {
        title: o.title,
        link: o.link,
        priceKrw: o.priceKrw,
        mallName: typeof o.mallName === "string" ? o.mallName : "",
        matchKind,
        matchLabel:
          typeof o.matchLabel === "string"
            ? o.matchLabel
            : matchKind === "same_likely"
              ? "동일 추정"
              : "유사",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function featureString(breakdown: unknown, key: string): string | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const v = features?.[key];
  return typeof v === "string" && v.trim() ? v : null;
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
  const listWhere = chinaUi
    ? showIgnored
      ? ignoredRecommendationWhere(tenantId)
      : activeRecommendationWhere(tenantId)
    : amazonFacingRecommendationWhere(tenantId, showIgnored);
  const ignoredCountWhere = chinaUi
    ? ignoredRecommendationWhere(tenantId)
    : amazonFacingRecommendationWhere(tenantId, true);

  const [items, ignoredCount] = await Promise.all([
    prisma.aiRecommendation.findMany({
      where: listWhere,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      include: {
        draft: { select: { id: true, status: true } },
        product: {
          select: {
            id: true,
            salePriceKrw: true,
            sourcePrice: true,
            costKrw: true,
          },
        },
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
      where: ignoredCountWhere,
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
            const costUsd =
              featureNumber(item.scoreBreakdown, "sourcePriceUsd") ??
              (item.product?.sourcePrice != null
                ? Number(item.product.sourcePrice)
                : null);
            const sell =
              featureNumber(item.scoreBreakdown, "sellPriceKrw") ??
              item.candidate?.sellPrice ??
              item.product?.salePriceKrw;
            const minViable =
              featureNumber(item.scoreBreakdown, "minViableSaleKrw") ?? null;
            const competitorAvg =
              featureNumber(item.scoreBreakdown, "competitorAvgKrw") ??
              readMarketVerdict(item.scoreBreakdown)?.competitorAvgKrw ??
              null;
            const sourceCostKrw =
              featureNumber(item.scoreBreakdown, "sourceCostKrw") ??
              item.product?.costKrw;
            const intlShippingKrw = featureNumber(
              item.scoreBreakdown,
              "intlShippingKrw",
            );
            const marketVerdict = readMarketVerdict(item.scoreBreakdown);
            const isFallbackCard =
              featureBool(item.scoreBreakdown, "isFallback") ||
              item.reasonCode === "FALLBACK";
            const targetMargin = featureNumber(
              item.scoreBreakdown,
              "targetMarginRate",
            );
            const shipping = isFallbackCard
              ? null
              : readShipping(item.scoreBreakdown);
            const competitorSamples = isFallbackCard
              ? []
              : readCompetitorSamples(item.scoreBreakdown);
            const naverKeyword = featureString(
              item.scoreBreakdown,
              "naverKeyword",
            );

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
                      isFallback={isFallbackCard}
                      costCny={isFallbackCard ? null : cost}
                      costUsd={isFallbackCard ? null : costUsd}
                      sellKrw={isFallbackCard ? null : sell}
                      minViableKrw={isFallbackCard ? null : minViable}
                      competitorAvgKrw={competitorAvg}
                      competitorSamples={competitorSamples}
                      naverKeyword={naverKeyword}
                      sourceCostKrw={isFallbackCard ? null : sourceCostKrw}
                      intlShippingKrw={
                        isFallbackCard ? null : intlShippingKrw
                      }
                      marginRate={isFallbackCard ? null : margin}
                      targetMarginRate={
                        isFallbackCard ? null : targetMargin
                      }
                      searchVolume={vol}
                      shipping={shipping}
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
