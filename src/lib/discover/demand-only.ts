import { Prisma, SupplyMall } from "@/generated/prisma/client";
import { getDemandAdapter } from "@/lib/discover/adapters";
import { fetchNaverCompetitorPrices } from "@/lib/discover/demand/naver-competitors";
import {
  scoreDiscoverCandidate,
  type DiscoverScoreBreakdown,
} from "@/lib/discover/score";
import type { JoinedCandidateMetrics } from "@/lib/discover/types";
import { prisma } from "@/lib/db";
import { buildProductViability } from "@/lib/recommend/product-viability";
import { getDefaultTenantId } from "@/lib/tenant";

export type DemandOnlyResultItem = {
  candidateId: string;
  recommendationId: string;
  keyword: string;
  title: string;
  score: number;
  label: string;
  reasonText: string | null;
  metrics: JoinedCandidateMetrics;
  breakdown: DiscoverScoreBreakdown;
  usedGpt: boolean;
  isStub: boolean;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function awaitAmazonSupplyId(keyword: string): string {
  return `await-amazon:${keyword.trim().toLowerCase().replace(/\s+/g, "")}`;
}

/**
 * 네이버 수요만으로 주간 후보 카드 생성.
 * 공급(Amazon)은 운영자가 URL을 붙일 때까지 대기.
 */
export async function discoverDemandOnlyByKeyword(
  keyword: string,
  options?: {
    tenantId?: string;
    minScore?: number;
  },
) {
  const trimmed = keyword.trim();
  if (!trimmed) throw new Error("keyword가 필요합니다.");

  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const minScore = options?.minScore ?? 0;

  const demandAdapter = getDemandAdapter();
  const demand = await demandAdapter.fetchDemand(trimmed);
  // 경쟁 시세는 키워드 기준. 쇼핑 1위 상품명은 카드 제목에 쓰지 않음
  // (예: 키워드「선풍기」1위가 무관한 모델명이면 가이드와 제목이 어긋남)
  const competitorMarket = await fetchNaverCompetitorPrices(trimmed, {
    sourceTitle: trimmed,
  });

  // 공급 미정이라 마진은 중성값 — 점수는 검색량·경쟁·리뷰·시즌 중심
  const pendingMargin = 0.25;
  const breakdown = scoreDiscoverCandidate({
    searchVolume: demand.searchVolume,
    competition: demand.competition,
    marginRate: pendingMargin,
    rating: demand.rating,
    reviewCount: demand.reviewCount,
    seasonalityScore: demand.seasonalityScore,
    marketVerdictCode: competitorMarket.avg != null ? null : "NO_MARKET_DATA",
  });
  breakdown.reasons = [
    "Amazon URL 대기(공급 미정)",
    ...breakdown.reasons.filter((r) => !r.includes("마진")),
    "마진은 Amazon 원가 붙인 뒤 재산정",
  ];

  if (breakdown.total < minScore) {
    return {
      tenantId,
      keyword: trimmed,
      demandMall: demand.mall,
      supplyMall: SupplyMall.MALL_1688,
      isStub: true,
      awaitingAmazon: true,
      created: 0,
      items: [] as DemandOnlyResultItem[],
      skippedPriceWar: false,
      marketType: null as string | null,
      message: `수요 점수 ${breakdown.total.toFixed(1)} < minScore ${minScore}`,
    };
  }

  const externalSupplyId = awaitAmazonSupplyId(trimmed);
  // 카드 제목 = 시드/수요 키워드. 네이버 쇼핑 1위 상품명은 참고용으로만 보관
  const title = `[수요] ${trimmed}`;
  const naverTopTitle =
    demand.title && demand.title.trim() && demand.title.trim() !== trimmed
      ? demand.title.trim()
      : null;
  const demandRaw = (demand.raw ?? {}) as Record<string, unknown>;
  const demandRawShopTotal =
    typeof demandRaw.shopTotal === "number" ? demandRaw.shopTotal : null;
  const naverSearchUrl =
    typeof demandRaw.demandSearchUrl === "string"
      ? demandRaw.demandSearchUrl
      : `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(trimmed)}`;
  const naverDemandUrl =
    typeof demand.demandUrl === "string" && demand.demandUrl.startsWith("http")
      ? demand.demandUrl
      : naverSearchUrl;
  const naverProductLink =
    typeof demandRaw.topProductLink === "string" &&
    demandRaw.topProductLink.startsWith("http")
      ? demandRaw.topProductLink
      : naverDemandUrl !== naverSearchUrl
        ? naverDemandUrl
        : null;

  const productViability = buildProductViability({
    keyword: trimmed,
    title,
    shopTotal: competitorMarket.shopTotal ?? demandRawShopTotal,
    uniqueMallCount: competitorMarket.uniqueMallCount,
    prices: competitorMarket.prices,
    sameLikelyCount: competitorMarket.sameLikelyCount,
    searchVolume: demand.searchVolume,
    competition: demand.competition,
    seasonalityScore: demand.seasonalityScore,
    reviewCount: demand.reviewCount,
    competitorAvgKrw: competitorMarket.avg,
    marketVerdictCode:
      competitorMarket.avg != null ? null : "NO_MARKET_DATA",
    awaitingSupply: true,
  });

  // 가격전쟁 + 낮은 추천도 → 목록을 채우지 않음 (스캔 실용성)
  if (
    productViability.marketType === "PRICE_WAR" &&
    productViability.recommendStars <= 2
  ) {
    return {
      tenantId,
      keyword: trimmed,
      demandMall: demand.mall,
      supplyMall: SupplyMall.MALL_1688,
      isStub: true,
      awaitingAmazon: true,
      created: 0,
      items: [] as DemandOnlyResultItem[],
      skippedPriceWar: true,
      marketType: productViability.marketType,
      message: `가격경쟁 시장 스킵(★${productViability.recommendStars}) — ${productViability.strategy}`,
    };
  }

  const metrics: JoinedCandidateMetrics = {
    keyword: trimmed,
    title,
    sourceDemandMall: demand.mall,
    sourceSupplyMall: SupplyMall.MALL_1688,
    demandUrl: naverDemandUrl,
    supplyUrl: null,
    externalDemandId: demand.externalDemandId,
    externalSupplyId,
    searchVolume: demand.searchVolume,
    competition: demand.competition,
    reviewCount: demand.reviewCount,
    rating: demand.rating,
    salesEstimate: demand.salesEstimate,
    costPriceCny: 0,
    sellPriceKrw: competitorMarket.avg ?? 0,
    marginRate: pendingMargin,
    seasonalityScore: demand.seasonalityScore,
    currency: "USD",
    isStub: true,
    rawMetrics: {
      awaitingAmazon: true,
      needsAmazonUrl: true,
      demandOnly: true,
      competitorAvgKrw: competitorMarket.avg,
      competitorCount: competitorMarket.prices.length,
      naverTopTitle,
      naverDemandUrl,
      naverSearchUrl,
      naverProductLink,
      demandRaw: demand.raw ?? null,
    },
  };

  const candidate = await prisma.productCandidate.upsert({
    where: {
      tenantId_sourceDemandMall_sourceSupplyMall_keyword_externalSupplyId: {
        tenantId,
        sourceDemandMall: metrics.sourceDemandMall,
        sourceSupplyMall: metrics.sourceSupplyMall,
        keyword: metrics.keyword,
        externalSupplyId: metrics.externalSupplyId,
      },
    },
    create: {
      tenantId,
      sourceDemandMall: metrics.sourceDemandMall,
      sourceSupplyMall: metrics.sourceSupplyMall,
      keyword: metrics.keyword,
      title: metrics.title,
      demandUrl: metrics.demandUrl,
      supplyUrl: null,
      externalDemandId: metrics.externalDemandId,
      externalSupplyId: metrics.externalSupplyId,
      searchVolume: metrics.searchVolume,
      competition: metrics.competition,
      reviewCount: metrics.reviewCount,
      rating: metrics.rating,
      salesEstimate: metrics.salesEstimate,
      costPrice: null,
      sellPrice: metrics.sellPriceKrw || null,
      marginRate: null,
      seasonalityScore: metrics.seasonalityScore,
      currency: "USD",
      isStub: true,
      rawMetrics: toJson(metrics.rawMetrics),
    },
    update: {
      title: metrics.title,
      demandUrl: metrics.demandUrl,
      searchVolume: metrics.searchVolume,
      competition: metrics.competition,
      reviewCount: metrics.reviewCount,
      rating: metrics.rating,
      salesEstimate: metrics.salesEstimate,
      sellPrice: metrics.sellPriceKrw || null,
      seasonalityScore: metrics.seasonalityScore,
      isStub: true,
      rawMetrics: toJson(metrics.rawMetrics),
    },
  });

  const reasonText = [
    `네이버 수요 키워드 「${trimmed}」 후보입니다. Amazon.com에서 같은 키워드로 상품을 찾아 URL을 붙이세요.`,
    naverTopTitle
      ? `(참고: 네이버 쇼핑 상위 노출 예 「${naverTopTitle}」 — 반드시 이 모델일 필요는 없습니다.)`
      : null,
    `${productViability.marketTypeLabel} · 희소성 ${productViability.scarcity}(${productViability.scarcityScore}점) · ${productViability.strategy}`,
    `수요 점수 ${breakdown.total.toFixed(1)}점(${breakdown.label}). 검색량 ${metrics.searchVolume.toLocaleString("ko-KR")}, 경쟁 ${metrics.competition.toFixed(2)}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const detailHtml = [
    "<section><h2>수요 키워드</h2>",
    `<p><strong>${trimmed}</strong> — Amazon URL을 붙이면 원가·몰테일·시장성을 계산합니다.</p>`,
    naverTopTitle
      ? `<p>네이버 쇼핑 상위 예: ${naverTopTitle}</p>`
      : "",
    `<p>${productViability.summary}</p>`,
    `<p>검색량 ${metrics.searchVolume.toLocaleString("ko-KR")} · 경쟁 ${metrics.competition.toFixed(2)} · 점수 ${breakdown.total.toFixed(1)}</p>`,
    "</section>",
  ].join("");

  const scorePayload = {
    ...breakdown,
    label: breakdown.label,
    features: {
      searchVolume: metrics.searchVolume,
      competition: metrics.competition,
      rating: metrics.rating,
      reviewCount: metrics.reviewCount,
      seasonalityScore: metrics.seasonalityScore,
      competitorAvgKrw: competitorMarket.avg,
      competitorSamples: competitorMarket.samples,
      shopTotal: competitorMarket.shopTotal ?? demandRawShopTotal,
      uniqueMallCount: competitorMarket.uniqueMallCount,
      naverKeyword: trimmed,
      naverTopTitle,
      needsAmazonUrl: true,
      awaitingAmazon: true,
      demandOnly: true,
      productViability,
    },
  };

  const existingPending = await prisma.aiRecommendation.findFirst({
    where: {
      tenantId,
      candidateId: candidate.id,
      status: { in: ["PENDING", "ACCEPTED", "DRAFT_CREATED"] },
    },
  });

  const recommendation = existingPending
    ? await prisma.aiRecommendation.update({
        where: { id: existingPending.id },
        data: {
          sourceUrl: metrics.demandUrl,
          externalId: metrics.externalSupplyId,
          title: metrics.title,
          score: breakdown.total,
          scoreBreakdown: toJson(scorePayload),
          reasonCode: "DEMAND_WATCH",
          reasonText,
          detailHtml,
        },
      })
    : await prisma.aiRecommendation.create({
        data: {
          tenantId,
          candidateId: candidate.id,
          sourceUrl: metrics.demandUrl,
          externalId: metrics.externalSupplyId,
          title: metrics.title,
          score: breakdown.total,
          scoreBreakdown: toJson(scorePayload),
          status: "PENDING",
          reasonCode: "DEMAND_WATCH",
          reasonText,
          detailHtml,
        },
      });

  const item: DemandOnlyResultItem = {
    candidateId: candidate.id,
    recommendationId: recommendation.id,
    keyword: trimmed,
    title: metrics.title,
    score: breakdown.total,
    label: breakdown.label,
    reasonText: recommendation.reasonText,
    metrics,
    breakdown,
    usedGpt: false,
    isStub: true,
  };

  return {
    tenantId,
    keyword: trimmed,
    demandMall: demand.mall,
    supplyMall: SupplyMall.MALL_1688,
    isStub: true,
    awaitingAmazon: true,
    created: 1,
    items: [item],
    skippedPriceWar: false,
    marketType: productViability.marketType,
  };
}

export type { DiscoverScoreBreakdown };
