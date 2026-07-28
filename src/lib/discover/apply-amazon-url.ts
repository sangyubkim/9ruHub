import {
  Prisma,
  ProductStatus,
  SourceMall,
  SupplyMall,
} from "@/generated/prisma/client";
import { fetchAmazonUsProduct } from "@/lib/amazon/fetch-product";
import { checkAmazonShipEligibility } from "@/lib/amazon/ship-eligibility";
import type { FetchedProduct } from "@/lib/amazon/types";
import { localizeTitle } from "@/lib/draft/detail-template";
import { prisma } from "@/lib/db";
import {
  enrichAmazonMarket,
  priceAmazonUsProduct,
} from "@/lib/recommend/amazon-enrich";
import { withAmazonScoreFeatures } from "@/lib/recommend/amazon-features";
import { generateRecommendCopy } from "@/lib/recommend/openai";
import {
  reasonCodeFromScore,
  scoreCandidate,
} from "@/lib/recommend/score";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asImageCount(images: unknown): number {
  return Array.isArray(images) ? images.length : 0;
}

function applyManualOverrides(
  fetched: FetchedProduct,
  input: { costUsd?: number; weightGrams?: number },
): FetchedProduct {
  const next = { ...fetched, raw: { ...(fetched.raw ?? {}) } };
  let touched = false;

  if (
    input.costUsd != null &&
    Number.isFinite(input.costUsd) &&
    input.costUsd > 0
  ) {
    next.sourcePrice = input.costUsd;
    next.raw = {
      ...next.raw,
      manualCostUsd: input.costUsd,
      wasFallback: fetched.isFallback,
    };
    touched = true;
  }

  if (
    input.weightGrams != null &&
    Number.isFinite(input.weightGrams) &&
    input.weightGrams > 0
  ) {
    next.weightGrams = input.weightGrams;
    next.raw = {
      ...next.raw,
      manualWeightGrams: input.weightGrams,
    };
    touched = true;
  }

  // 수동 원가를 넣으면 폴백($29.99) 해제
  if (
    input.costUsd != null &&
    Number.isFinite(input.costUsd) &&
    input.costUsd > 0
  ) {
    next.isFallback = false;
  } else if (touched) {
    // 무게만 수정한 경우는 가격 폴백 상태 유지 가능
  }

  return next;
}

/**
 * Amazon URL(+선택 USD 원가·무게)을 붙여 몰테일·시세·시장성으로 갱신한다.
 * - 주간 수요 대기(DEMAND_WATCH)
 * - 가격 폴백(FALLBACK) 카드 재적용(삭제 없이 수동 값으로 수정)
 */
export async function applyAmazonUrlToRecommendation(
  recommendationId: string,
  input: {
    url?: string;
    costUsd?: number;
    weightGrams?: number;
  },
) {
  const recommendation = await prisma.aiRecommendation.findUnique({
    where: { id: recommendationId },
    include: { candidate: true },
  });
  if (!recommendation) throw new Error("추천을 찾을 수 없습니다.");

  const breakdownRoot = recommendation.scoreBreakdown as {
    features?: {
      needsAmazonUrl?: boolean;
      naverKeyword?: string;
      isFallback?: boolean;
    };
  } | null;
  const awaitingInRaw = Boolean(
    recommendation.candidate &&
      (recommendation.candidate.rawMetrics as { awaitingAmazon?: boolean } | null)
        ?.awaitingAmazon,
  );
  const needsAmazonUrl =
    recommendation.reasonCode === "DEMAND_WATCH" ||
    breakdownRoot?.features?.needsAmazonUrl === true ||
    awaitingInRaw;
  const isFallbackCard =
    recommendation.reasonCode === "FALLBACK" ||
    breakdownRoot?.features?.isFallback === true;

  if (!needsAmazonUrl && !isFallbackCard) {
    throw new Error(
      "Amazon URL/원가를 적용할 수 있는 카드가 아닙니다. 수요 대기 또는 가격 폴백 카드에만 적용하세요.",
    );
  }

  const url =
    input.url?.trim() ||
    recommendation.sourceUrl?.trim() ||
    recommendation.externalId?.trim() ||
    "";
  if (!url) {
    throw new Error("Amazon 상품 URL 또는 ASIN이 필요합니다.");
  }
  if (isFallbackCard && (input.costUsd == null || input.costUsd <= 0)) {
    throw new Error(
      "가격을 자동으로 못 읽은 카드입니다. 브라우저에 보이는 실가(USD)를 입력하세요.",
    );
  }

  let fetched = await fetchAmazonUsProduct(url);
  fetched = applyManualOverrides(fetched, {
    costUsd: input.costUsd,
    weightGrams: input.weightGrams,
  });

  // Amazon URL 부착 시 US/KR 배송 가능 여부 best-effort (실패해도 흐름 계속)
  const shipEligibility = fetched.isFallback
    ? null
    : await checkAmazonShipEligibility(fetched.asin).catch(() => null);

  const priced = await priceAmazonUsProduct(
    recommendation.tenantId,
    fetched.sourcePrice,
    fetched.weightGrams,
  );
  const market = await enrichAmazonMarket(fetched, priced);

  const sourceProduct = await prisma.sourceProduct.upsert({
    where: {
      tenantId_mall_externalId: {
        tenantId: recommendation.tenantId,
        mall: SourceMall.AMAZON_US,
        externalId: fetched.asin,
      },
    },
    create: {
      tenantId: recommendation.tenantId,
      mall: SourceMall.AMAZON_US,
      sourceUrl: fetched.sourceUrl,
      externalId: fetched.asin,
      title: fetched.title,
      brand: fetched.brand,
      currency: fetched.currency,
      sourcePrice: fetched.sourcePrice,
      inStock: fetched.inStock,
      images: toJson(fetched.images),
      options: toJson(fetched.options),
    },
    update: {
      sourceUrl: fetched.sourceUrl,
      title: fetched.title,
      brand: fetched.brand,
      sourcePrice: fetched.sourcePrice,
      inStock: fetched.inStock,
      images: toJson(fetched.images),
      options: toJson(fetched.options),
      fetchedAt: new Date(),
    },
  });

  const titleKo = localizeTitle(fetched.title, fetched.brand);
  const product = await prisma.product.upsert({
    where: {
      tenantId_sourceMall_externalId: {
        tenantId: recommendation.tenantId,
        sourceMall: SourceMall.AMAZON_US,
        externalId: fetched.asin,
      },
    },
    create: {
      tenantId: recommendation.tenantId,
      sourceProductId: sourceProduct.id,
      title: fetched.title,
      titleKo,
      brand: fetched.brand,
      status: ProductStatus.SOURCING,
      sourceMall: SourceMall.AMAZON_US,
      sourceUrl: fetched.sourceUrl,
      externalId: fetched.asin,
      currency: fetched.currency,
      sourcePrice: fetched.sourcePrice,
      salePriceKrw: priced.salePriceKrw,
      costKrw: priced.costKrw,
      inStock: fetched.inStock,
      images: toJson(fetched.images),
    },
    update: {
      sourceProductId: sourceProduct.id,
      title: fetched.title,
      titleKo,
      brand: fetched.brand,
      sourceUrl: fetched.sourceUrl,
      sourcePrice: fetched.sourcePrice,
      salePriceKrw: priced.salePriceKrw,
      costKrw: priced.costKrw,
      inStock: fetched.inStock,
      images: toJson(fetched.images),
    },
  });

  const sourcePriceUsd = Number(product.sourcePrice);
  const scoreBreakdown = scoreCandidate({
    title: product.title,
    brand: product.brand,
    sourcePriceUsd,
    salePriceKrw: priced.salePriceKrw,
    costKrw: priced.costKrw,
    inStock: product.inStock,
    imageCount: asImageCount(product.images),
    alreadyListed: false,
    recentSales: product.totalSold,
  });

  const naverKeyword =
    recommendation.candidate?.keyword ??
    breakdownRoot?.features?.naverKeyword ??
    market.keyword;

  const scorePayload = withAmazonScoreFeatures(
    scoreBreakdown,
    priced,
    sourcePriceUsd,
    {
      intlShippingKrw: priced.intlShippingKrw,
      competitorAvgKrw: market.competitorAvgKrw,
      competitorSamples: market.competitorSamples,
      minViableSaleKrw: priced.minViableSaleKrw,
      marketVerdict: market.marketVerdict,
      isFallback: fetched.isFallback,
      naverKeyword,
      targetMarginRate: priced.targetMarginRate,
      shipping: priced.shipping,
      needsAmazonUrl: false,
      title: fetched.title,
      brand: fetched.brand,
      shopTotal: market.shopTotal,
      uniqueMallCount: market.uniqueMallCount,
      sameLikelyCount: market.sameLikelyCount,
      competitorPrices: market.competitorPrices,
      searchVolume: recommendation.candidate?.searchVolume ?? null,
      competition:
        recommendation.candidate?.competition != null
          ? Number(recommendation.candidate.competition)
          : null,
      seasonalityScore:
        recommendation.candidate?.seasonalityScore != null
          ? Number(recommendation.candidate.seasonalityScore)
          : null,
      reviewCount: recommendation.candidate?.reviewCount ?? null,
      shipEligibility,
    },
  );

  let reasonCode = reasonCodeFromScore(scoreBreakdown.total);
  let score = scoreBreakdown.total;
  let reasonText: string;
  let detailHtml: string;

  if (fetched.isFallback) {
    const { amazonFallbackReasonMessage } = await import(
      "@/lib/amazon/fetch-product"
    );
    const failReason =
      fetched.raw && typeof fetched.raw.reason === "string"
        ? fetched.raw.reason
        : undefined;
    reasonCode = "FALLBACK";
    score = 0;
    reasonText = `${amazonFallbackReasonMessage(failReason)} 수동 USD 원가를 다시 넣어 갱신할 수 있습니다.`;
    detailHtml = `<section><h2>가격 확인 필요</h2><p>${amazonFallbackReasonMessage(failReason)}</p></section>`;
  } else {
    const copy = await generateRecommendCopy({
      title: product.titleKo ?? product.title,
      brand: product.brand,
      sourceUrl: product.sourceUrl,
      sourcePriceUsd,
      salePriceKrw: priced.salePriceKrw,
      costKrw: priced.costKrw,
      inStock: product.inStock,
      score: scoreBreakdown.total,
      scoreBreakdown,
    });
    reasonText = copy.reasonText;
    detailHtml = copy.detailHtml;
  }

  if (recommendation.candidate) {
    const prevRaw =
      (recommendation.candidate.rawMetrics as Record<string, unknown> | null) ??
      {};
    await prisma.productCandidate.update({
      where: { id: recommendation.candidate.id },
      data: {
        title: product.titleKo ?? product.title,
        supplyUrl: fetched.sourceUrl,
        externalSupplyId: fetched.asin,
        sourceSupplyMall: SupplyMall.MALL_1688,
        costPrice: fetched.sourcePrice,
        sellPrice: priced.salePriceKrw,
        marginRate:
          priced.salePriceKrw > 0
            ? (priced.salePriceKrw - priced.costKrw) / priced.salePriceKrw
            : null,
        currency: "USD",
        isStub: false,
        rawMetrics: toJson({
          ...prevRaw,
          awaitingAmazon: false,
          needsAmazonUrl: false,
          demandOnly: false,
          amazonAsin: fetched.asin,
          amazonUrl: fetched.sourceUrl,
          isFallback: fetched.isFallback,
          manualCostUsd: input.costUsd ?? null,
          manualWeightGrams: input.weightGrams ?? null,
          shipEligibility: shipEligibility ?? null,
          krDirectShip: shipEligibility?.krDirectShip ?? null,
        }),
      },
    });
  }

  const updated = await prisma.aiRecommendation.update({
    where: { id: recommendation.id },
    data: {
      productId: product.id,
      sourceUrl: fetched.sourceUrl,
      externalId: fetched.asin,
      title: product.titleKo ?? product.title,
      score,
      scoreBreakdown: toJson({ ...scorePayload, total: score }),
      reasonCode,
      reasonText,
      detailHtml,
    },
  });

  return {
    recommendation: updated,
    product,
    fetched,
    priced,
    market,
    score,
    label: reasonCode,
    isFallback: fetched.isFallback,
  };
}
