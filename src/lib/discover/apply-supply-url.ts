import { Prisma } from "@/generated/prisma/client";
import { generateDiscoverRecommendCopy } from "@/lib/discover/openai";
import { joinDemandAndSupply } from "@/lib/discover/pricing";
import { scoreDiscoverCandidate } from "@/lib/discover/score";
import { fetch1688Offer } from "@/lib/discover/supply/fetch-1688-offer";
import type { DemandMetrics } from "@/lib/discover/types";
import { prisma } from "@/lib/db";
import { DemandMall, SupplyMall } from "@/generated/prisma/client";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function num(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 추천(후보)에 1688 실 URL·원가를 붙여 마진/점수를 다시 계산한다.
 */
export async function apply1688SupplyUrlToRecommendation(
  recommendationId: string,
  input: {
    supplyUrl: string;
    costPriceCny?: number;
  },
) {
  const recommendation = await prisma.aiRecommendation.findUnique({
    where: { id: recommendationId },
    include: { candidate: true },
  });
  if (!recommendation) throw new Error("추천을 찾을 수 없습니다.");
  if (!recommendation.candidate) {
    throw new Error("발굴 후보가 없는 추천입니다. 키워드 발굴 항목에만 적용할 수 있습니다.");
  }

  const candidate = recommendation.candidate;
  const offer = await fetch1688Offer(input.supplyUrl, {
    costPriceCnyOverride: input.costPriceCny,
    titleHint: candidate.title,
  });

  const raw = candidate.rawMetrics as {
    demand?: { provider?: string; volumeSource?: string };
  } | null;
  const demandLooksLive =
    raw?.demand?.provider === "naver-demand-live" ||
    raw?.demand?.volumeSource === "searchad" ||
    raw?.demand?.volumeSource === "shop_total_proxy";
  const demandLooksStub = Boolean(raw?.demand?.provider?.includes("stub"));
  // 공급을 live로 붙일 때: 수요가 stub으로 명확하면 stub 유지, 그 외(live·시드)는 수요 live로 간주
  const demandIsStub = demandLooksStub ? true : demandLooksLive ? false : false;

  const demand: DemandMetrics = {
    mall: candidate.sourceDemandMall as DemandMall,
    keyword: candidate.keyword,
    title: candidate.title,
    demandUrl: candidate.demandUrl,
    externalDemandId: candidate.externalDemandId,
    searchVolume: candidate.searchVolume ?? 0,
    competition: num(candidate.competition, 0.5),
    reviewCount: candidate.reviewCount ?? 0,
    rating: num(candidate.rating, 4),
    salesEstimate: candidate.salesEstimate ?? 0,
    seasonalityScore: num(candidate.seasonalityScore, 50),
    isStub: demandIsStub,
    raw: raw?.demand ?? { fromCandidate: true },
  };

  const metrics = joinDemandAndSupply(demand, {
    mall: SupplyMall.MALL_1688,
    title: offer.title,
    supplyUrl: offer.supplyUrl,
    externalSupplyId: offer.externalSupplyId,
    costPriceCny: offer.costPriceCny,
    moq: offer.moq,
    isStub: offer.isStub,
    raw: offer.raw,
  });

  const breakdown = scoreDiscoverCandidate({
    searchVolume: metrics.searchVolume,
    competition: metrics.competition,
    marginRate: metrics.marginRate,
    rating: metrics.rating,
    reviewCount: metrics.reviewCount,
    seasonalityScore: metrics.seasonalityScore,
  });

  const copy = await generateDiscoverRecommendCopy(metrics, breakdown);

  let updatedCandidate;
  try {
    updatedCandidate = await prisma.productCandidate.update({
      where: { id: candidate.id },
      data: {
        title: metrics.title,
        supplyUrl: metrics.supplyUrl,
        externalSupplyId: metrics.externalSupplyId,
        costPrice: metrics.costPriceCny,
        sellPrice: metrics.sellPriceKrw,
        marginRate: metrics.marginRate,
        isStub: metrics.isStub,
        rawMetrics: toJson(metrics.rawMetrics),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(
        "이 1688 상품은 같은 키워드 후보에 이미 연결되어 있습니다.",
      );
    }
    throw err;
  }

  const updatedRec = await prisma.aiRecommendation.update({
    where: { id: recommendation.id },
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
  });

  return {
    recommendation: updatedRec,
    candidate: updatedCandidate,
    metrics,
    breakdown,
    offer: {
      supplyUrl: offer.supplyUrl,
      costPriceCny: offer.costPriceCny,
      isFallback: offer.isFallback,
      fetchError: offer.fetchError ?? null,
    },
  };
}
