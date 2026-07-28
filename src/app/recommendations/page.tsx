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
import { AttachAmazonUrlForm } from "@/app/recommendations/AttachAmazonUrlForm";
import { DiscoverKeywordForm } from "@/app/recommendations/DiscoverKeywordForm";
import { FreshScanBadge } from "@/app/recommendations/FreshScanBadge";
import { RecommendActions } from "@/app/recommendations/RecommendActions";
import {
  RecommendBulkProvider,
  RecommendBulkToolbar,
  RecommendSelectCheckbox,
} from "@/app/recommendations/RecommendBulkControls";
import { RecommendCleanupBar } from "@/app/recommendations/RecommendCleanupBar";
import { RecommendEconomics } from "@/app/recommendations/RecommendEconomics";
import { RecommendGenerateForm } from "@/app/recommendations/RecommendGenerateForm";
import { WeeklyDiscoverForm } from "@/app/recommendations/WeeklyDiscoverForm";
import {
  filterRecommendationsByVerdict,
  isNotRecommendedBreakdown,
  parseVerdictFilter,
  sortRecommendationsByViability,
} from "@/lib/recommend/sort-recommendations";

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

function readDecisionGuide(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const g = features?.decisionGuide;
  if (!g || typeof g !== "object") return null;
  const o = g as Record<string, unknown>;
  if (
    typeof o.recommendedSaleKrw !== "number" ||
    typeof o.saleLowKrw !== "number" ||
    typeof o.saleHighKrw !== "number" ||
    typeof o.expectedProfitKrw !== "number" ||
    typeof o.grade !== "string"
  ) {
    return null;
  }
  return g as import("@/lib/recommend/decision-guide").DecisionGuide;
}

function readProductViability(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const v = features?.productViability;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (
    typeof o.marketType !== "string" ||
    typeof o.scarcity !== "string" ||
    typeof o.priceCompetitiveness !== "string" ||
    typeof o.recommendStars !== "number"
  ) {
    return null;
  }
  return v as import("@/lib/recommend/product-viability").ProductViability;
}

function readSourcingFit(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const fromRoot = features?.sourcingFit;
  const fromPv =
    features?.productViability &&
    typeof features.productViability === "object"
      ? (features.productViability as { sourcingFit?: unknown }).sourcingFit
      : null;
  const v = fromRoot ?? fromPv;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.code !== "string" || typeof o.label !== "string") return null;
  return v as import("@/lib/recommend/sourcing-fit").SourcingFit;
}

function readShipEligibility(breakdown: unknown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  const features = (breakdown as { features?: Record<string, unknown> }).features;
  const fromRoot = features?.shipEligibility;
  const fromPv =
    features?.productViability &&
    typeof features.productViability === "object"
      ? (features.productViability as { shipEligibility?: unknown })
          .shipEligibility
      : null;
  const v = fromRoot ?? fromPv;
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!o.us || !o.kr) return null;
  return v as import("@/lib/amazon/ship-eligibility").AmazonShipEligibility;
}

function numField(root: Record<string, unknown>, key: string): number | null {
  const v = root[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** scoreBreakdown → hover 툴팁용 가감 항목 */
function readScoreDetail(breakdown: unknown): {
  kind: "discover" | "amazon" | "other";
  parts: Array<{ label: string; value: number }>;
  reasons: string[];
} | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const root = breakdown as Record<string, unknown>;
  const reasons = Array.isArray(root.reasons)
    ? root.reasons.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
    : [];

  const hasDiscover =
    numField(root, "volumeScore") != null ||
    numField(root, "competitionScore") != null;
  const hasAmazon =
    numField(root, "priceBandScore") != null ||
    numField(root, "stockScore") != null;

  if (hasDiscover) {
    const parts = [
      { label: "검색량", value: numField(root, "volumeScore") },
      { label: "경쟁", value: numField(root, "competitionScore") },
      { label: "마진", value: numField(root, "marginScore") },
      { label: "평점", value: numField(root, "ratingScore") },
      { label: "리뷰", value: numField(root, "reviewScore") },
      { label: "시즌", value: numField(root, "seasonalityScore") },
      { label: "시장성", value: numField(root, "marketScore") },
    ]
      .filter((p): p is { label: string; value: number } => p.value != null)
      .map((p) => ({ label: p.label, value: p.value }));
    return { kind: "discover", parts, reasons };
  }

  if (hasAmazon) {
    const parts = [
      { label: "마진", value: numField(root, "marginScore") },
      { label: "가격대", value: numField(root, "priceBandScore") },
      { label: "재고", value: numField(root, "stockScore") },
      { label: "브랜드", value: numField(root, "brandScore") },
      { label: "이미지", value: numField(root, "imageScore") },
      { label: "리스팅 감점", value: numField(root, "listingPenalty") },
      { label: "판매 가산", value: numField(root, "salesBoost") },
    ]
      .filter((p): p is { label: string; value: number } => p.value != null)
      .map((p) => ({ label: p.label, value: p.value }));
    return { kind: "amazon", parts, reasons };
  }

  if (reasons.length === 0) return null;
  return { kind: "other", parts: [], reasons };
}

type PageProps = {
  searchParams?: Promise<{ ignored?: string; verdict?: string }>;
};

export default async function RecommendationsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const showIgnored =
    params.ignored === "1" || params.ignored === "true";
  const verdict = parseVerdictFilter(params.verdict);
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

  const [rawItems, ignoredCount] = await Promise.all([
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
      take: 200,
    }),
    prisma.aiRecommendation.count({
      where: ignoredCountWhere,
    }),
  ]);

  const sortedItems = sortRecommendationsByViability(rawItems);
  const items = filterRecommendationsByVerdict(sortedItems, verdict).slice(
    0,
    100,
  );
  const rejectIds = showIgnored
    ? []
    : sortedItems
        .filter((item) => isNotRecommendedBreakdown(item.scoreBreakdown))
        .map((item) => item.id);

  const verdictHref = (v: string) => {
    const q = new URLSearchParams();
    if (showIgnored) q.set("ignored", "1");
    if (v !== "all") q.set("verdict", v);
    const s = q.toString();
    return s ? `/recommendations?${s}` : "/recommendations";
  };

  return (
    <div className="space-y-8">
      <section className="max-w-4xl">
        <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          AI 상품 발굴 · 추천
        </h2>
        <p className="mt-2 text-base text-zinc-600">
          주력은 Amazon US URL 소싱입니다. 상품 링크를 넣으면 원가·몰테일
          국제배송·판매가를 추천합니다. 주간 발굴은 네이버 수요 후보를 만들고,
          운영자가 Amazon URL을 붙여 확정합니다.
          {chinaUi
            ? " 네이버↔1688 레거시 폼은 아래 섹션에 있습니다."
            : " 중국(1688) UI는 기본 비활성입니다."}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-zinc-700">
          Amazon URL / 기존 스캔
        </h3>
        <p className="text-sm text-zinc-500">
          amazon.com 상품 URL 또는 ASIN → 추천 카드 · 초안 연결
        </p>
        <RecommendGenerateForm />
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-zinc-700">
          이번 주 네이버 수요 후보
        </h3>
        <p className="text-sm text-zinc-500">
          네이버 검색량·경쟁으로 후보를 만든 뒤, 카드에 Amazon URL을 붙이세요.
        </p>
        <WeeklyDiscoverForm />
      </section>

      {chinaUi ? (
        <section className="space-y-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4">
          <h3 className="text-base font-semibold text-zinc-600">
            레거시 · 네이버↔1688 발굴
          </h3>
          <DiscoverKeywordForm />
        </section>
      ) : null}

      <section className="space-y-3">
        <RecommendCleanupBar
          activeCount={showIgnored ? 0 : sortedItems.length}
          ignoredCount={ignoredCount}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-700">
            {showIgnored ? "무시된 추천" : "추천 목록"}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              (추천도 ★ 높은 순)
            </span>
          </h3>
          {showIgnored ? (
            <Link
              href="/recommendations"
              className="text-sm text-sky-800 underline"
            >
              활성 목록으로
            </Link>
          ) : ignoredCount > 0 ? (
            <Link
              href="/recommendations?ignored=1"
              className="text-sm text-zinc-500 underline hover:text-sky-800"
            >
              무시된 항목 보기 ({ignoredCount})
            </Link>
          ) : null}
        </div>
        {!showIgnored ? (
          <div className="flex flex-wrap gap-2 text-sm">
            {(
              [
                ["all", "전체"],
                ["recommend", "추천 ★≥4"],
                ["hold", "검토 ★3"],
                ["reject", "비추천 ★≤2"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={verdictHref(key)}
                className={`rounded-full px-3 py-1 ${
                  verdict === key
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        ) : null}
        <RecommendBulkProvider rejectIds={rejectIds}>
          {!showIgnored && items.length > 0 ? <RecommendBulkToolbar /> : null}
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-8 text-base text-zinc-500">
            {showIgnored
              ? "무시된 추천이 없습니다."
              : verdict !== "all"
                ? "이 필터에 해당하는 추천이 없습니다."
              : "추천이 없습니다. Amazon URL을 넣거나 「이번 주 추천 새로고침」으로 수요 후보를 만드세요."}
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
            const costUsd =
              featureNumber(item.scoreBreakdown, "sourcePriceUsd") ??
              (item.product?.sourcePrice != null
                ? Number(item.product.sourcePrice)
                : null);
            // Amazon USD가 있으면 CNY 원가로 오인하지 않음
            const cost =
              costUsd != null
                ? null
                : item.candidate?.costPrice != null
                  ? Number(item.candidate.costPrice)
                  : featureNumber(item.scoreBreakdown, "costPriceCny");
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
            const needsAmazonUrl =
              item.reasonCode === "DEMAND_WATCH" ||
              featureBool(item.scoreBreakdown, "needsAmazonUrl");
            const scoreDetail = readScoreDetail(item.scoreBreakdown);
            const decisionGuide = readDecisionGuide(item.scoreBreakdown);
            const productViability = readProductViability(item.scoreBreakdown);
            const sourcingFit = readSourcingFit(item.scoreBreakdown);
            const shipEligibility = readShipEligibility(item.scoreBreakdown);

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
                className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!showIgnored ? (
                        <RecommendSelectCheckbox id={item.id} />
                      ) : null}
                      {item.candidate && chinaUi ? (
                        <p className="text-sm text-zinc-500">
                          {item.candidate.sourceDemandMall}↔
                          {item.candidate.sourceSupplyMall}
                        </p>
                      ) : null}
                      {needsAmazonUrl ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                          Amazon URL 필요
                        </span>
                      ) : null}
                      <FreshScanBadge recommendationId={item.id} />
                    </div>
                    <h3 className="mt-1 text-2xl font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    {item.candidate?.keyword ? (
                      <p className="mt-1 text-sm text-zinc-500">
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
                      scoreDetail={scoreDetail}
                      decisionGuide={
                        isFallbackCard ? null : decisionGuide
                      }
                      productViability={productViability}
                      sourcingFit={isFallbackCard ? null : sourcingFit}
                      shipEligibility={
                        isFallbackCard ? null : shipEligibility
                      }
                    />
                    {item.reasonText ? (
                      <p className="mt-3 text-base leading-relaxed text-zinc-600">
                        {item.reasonText}
                      </p>
                    ) : null}
                    {amazonOrOtherUrl ? (
                      <a
                        href={amazonOrOtherUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-sky-800 underline"
                      >
                        원본 보기
                      </a>
                    ) : chinaUi && realOfferUrl ? (
                      <a
                        href={realOfferUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-sky-800 underline"
                      >
                        원본 보기
                      </a>
                    ) : chinaUi && searchHref ? (
                      <a
                        href={searchHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-sky-800 underline"
                      >
                        {isStubCard
                          ? "1688에서 검색 (스텁·실상품 아님)"
                          : "1688에서 검색"}
                      </a>
                    ) : null}
                  </div>
                  <div className="text-right text-sm text-zinc-500">
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
                {(needsAmazonUrl || isFallbackCard) &&
                item.status !== "IGNORED" &&
                item.status !== "CONVERTED" ? (
                  <AttachAmazonUrlForm
                    recommendationId={item.id}
                    mode={isFallbackCard && !needsAmazonUrl ? "fix" : "attach"}
                    initialUrl={
                      isFallbackCard
                        ? (amazonOrOtherUrl ?? item.sourceUrl ?? undefined)
                        : undefined
                    }
                    keywordHint={
                      item.candidate?.keyword ?? naverKeyword ?? undefined
                    }
                  />
                ) : null}
                {chinaUi &&
                !needsAmazonUrl &&
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
        </RecommendBulkProvider>
      </section>
    </div>
  );
}
