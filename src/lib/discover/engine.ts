import { Prisma } from "@/generated/prisma/client";
import { getDemandAdapter, getSupplyAdapter } from "@/lib/discover/adapters";
import { generateDiscoverRecommendCopy } from "@/lib/discover/openai";
import { joinDemandAndSupply } from "@/lib/discover/pricing";
import {
  scoreDiscoverCandidate,
  type DiscoverScoreBreakdown,
} from "@/lib/discover/score";
import type { JoinedCandidateMetrics } from "@/lib/discover/types";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type DiscoverResultItem = {
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

/**
 * 키워드 발굴: 수요/공급 어댑터 → 후보 upsert → 규칙 점수 → ai_recommendations
 */
export async function discoverByKeyword(
  keyword: string,
  options?: {
    tenantId?: string;
    supplyLimit?: number;
    minScore?: number;
  },
) {
  const trimmed = keyword.trim();
  if (!trimmed) throw new Error("keyword가 필요합니다.");

  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const supplyLimit = options?.supplyLimit ?? 3;
  const minScore = options?.minScore ?? 0;

  const demandAdapter = getDemandAdapter();
  const supplyAdapter = getSupplyAdapter();

  const demand = await demandAdapter.fetchDemand(trimmed);
  const offers = await supplyAdapter.fetchSupplyOffers(trimmed, supplyLimit);

  if (offers.length === 0) {
    return {
      tenantId,
      keyword: trimmed,
      demandMall: demand.mall,
      supplyMall: supplyAdapter.mall,
      isStub: demand.isStub,
      created: 0,
      items: [] as DiscoverResultItem[],
      message: "공급 오퍼가 없습니다(확장 스텁이거나 결과 없음).",
    };
  }

  const items: DiscoverResultItem[] = [];

  for (const offer of offers) {
    const metrics = joinDemandAndSupply(demand, offer);
    const breakdown = scoreDiscoverCandidate({
      searchVolume: metrics.searchVolume,
      competition: metrics.competition,
      marginRate: metrics.marginRate,
      rating: metrics.rating,
      reviewCount: metrics.reviewCount,
      seasonalityScore: metrics.seasonalityScore,
    });

    if (breakdown.total < minScore) continue;

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
        supplyUrl: metrics.supplyUrl,
        externalDemandId: metrics.externalDemandId,
        externalSupplyId: metrics.externalSupplyId,
        searchVolume: metrics.searchVolume,
        competition: metrics.competition,
        reviewCount: metrics.reviewCount,
        rating: metrics.rating,
        salesEstimate: metrics.salesEstimate,
        costPrice: metrics.costPriceCny,
        sellPrice: metrics.sellPriceKrw,
        marginRate: metrics.marginRate,
        seasonalityScore: metrics.seasonalityScore,
        currency: metrics.currency,
        isStub: metrics.isStub,
        rawMetrics: toJson(metrics.rawMetrics),
      },
      update: {
        title: metrics.title,
        demandUrl: metrics.demandUrl,
        supplyUrl: metrics.supplyUrl,
        externalDemandId: metrics.externalDemandId,
        searchVolume: metrics.searchVolume,
        competition: metrics.competition,
        reviewCount: metrics.reviewCount,
        rating: metrics.rating,
        salesEstimate: metrics.salesEstimate,
        costPrice: metrics.costPriceCny,
        sellPrice: metrics.sellPriceKrw,
        marginRate: metrics.marginRate,
        seasonalityScore: metrics.seasonalityScore,
        isStub: metrics.isStub,
        rawMetrics: toJson(metrics.rawMetrics),
      },
    });

    const copy = await generateDiscoverRecommendCopy(metrics, breakdown);

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
            sourceUrl: metrics.supplyUrl ?? metrics.demandUrl,
            externalId: metrics.externalSupplyId,
            title: metrics.title,
            score: breakdown.total,
            scoreBreakdown: toJson({
              ...breakdown,
              features: {
                searchVolume: metrics.searchVolume,
                competition: metrics.competition,
                marginRate: metrics.marginRate,
                rating: metrics.rating,
                reviewCount: metrics.reviewCount,
                seasonalityScore: metrics.seasonalityScore,
                costPriceCny: metrics.costPriceCny,
                sellPriceKrw: metrics.sellPriceKrw,
              },
            }),
            reasonCode: breakdown.label,
            reasonText: copy.reasonText,
            detailHtml: copy.detailHtml,
          },
        })
      : await prisma.aiRecommendation.create({
          data: {
            tenantId,
            candidateId: candidate.id,
            sourceUrl: metrics.supplyUrl ?? metrics.demandUrl,
            externalId: metrics.externalSupplyId,
            title: metrics.title,
            score: breakdown.total,
            scoreBreakdown: toJson({
              ...breakdown,
              features: {
                searchVolume: metrics.searchVolume,
                competition: metrics.competition,
                marginRate: metrics.marginRate,
                rating: metrics.rating,
                reviewCount: metrics.reviewCount,
                seasonalityScore: metrics.seasonalityScore,
                costPriceCny: metrics.costPriceCny,
                sellPriceKrw: metrics.sellPriceKrw,
              },
            }),
            status: "PENDING",
            reasonCode: breakdown.label,
            reasonText: copy.reasonText,
            detailHtml: copy.detailHtml,
          },
        });

    items.push({
      candidateId: candidate.id,
      recommendationId: recommendation.id,
      keyword: metrics.keyword,
      title: metrics.title,
      score: breakdown.total,
      label: breakdown.label,
      reasonText: recommendation.reasonText,
      metrics,
      breakdown,
      usedGpt: copy.usedGpt,
      isStub: metrics.isStub,
    });
  }

  items.sort((a, b) => b.score - a.score);

  return {
    tenantId,
    keyword: trimmed,
    demandMall: demand.mall,
    supplyMall: supplyAdapter.mall,
    isStub: demand.isStub || offers.some((o) => o.isStub),
    created: items.length,
    items,
  };
}
