import { Prisma, SupplyMall } from "@/generated/prisma/client";
import { getDemandAdapter } from "@/lib/discover/adapters";
import { fetchNaverCompetitorPrices } from "@/lib/discover/demand/naver-competitors";
import { generateDiscoverRecommendCopy } from "@/lib/discover/openai";
import {
  scoreDiscoverCandidate,
  type DiscoverScoreBreakdown,
} from "@/lib/discover/score";
import type { JoinedCandidateMetrics } from "@/lib/discover/types";
import { prisma } from "@/lib/db";
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
  const competitorMarket = await fetchNaverCompetitorPrices(trimmed, {
    sourceTitle: demand.title,
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
      message: `수요 점수 ${breakdown.total.toFixed(1)} < minScore ${minScore}`,
    };
  }

  const externalSupplyId = awaitAmazonSupplyId(trimmed);
  const title = `[수요] ${demand.title || trimmed}`;

  const metrics: JoinedCandidateMetrics = {
    keyword: trimmed,
    title,
    sourceDemandMall: demand.mall,
    sourceSupplyMall: SupplyMall.MALL_1688,
    demandUrl: demand.demandUrl,
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

  const copy = await generateDiscoverRecommendCopy(metrics, breakdown);
  const reasonText = [
    `네이버 수요 후보입니다. Amazon.com에서 「${trimmed}」 상품을 찾아 URL을 붙이세요.`,
    copy.reasonText,
  ]
    .filter(Boolean)
    .join(" ");

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
      naverKeyword: trimmed,
      needsAmazonUrl: true,
      awaitingAmazon: true,
      demandOnly: true,
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
          detailHtml: copy.detailHtml,
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
          detailHtml: copy.detailHtml,
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
    usedGpt: copy.usedGpt,
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
  };
}

export type { DiscoverScoreBreakdown };
