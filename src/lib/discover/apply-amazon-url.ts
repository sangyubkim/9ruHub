import {
  Prisma,
  ProductStatus,
  SourceMall,
  SupplyMall,
} from "@/generated/prisma/client";
import { fetchAmazonUsProduct } from "@/lib/amazon/fetch-product";
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

function applyManualUsdCost(
  fetched: FetchedProduct,
  costUsd: number | undefined,
): FetchedProduct {
  if (costUsd == null || !Number.isFinite(costUsd) || costUsd <= 0) {
    return fetched;
  }
  return {
    ...fetched,
    sourcePrice: costUsd,
    isFallback: false,
    raw: {
      ...(fetched.raw ?? {}),
      manualCostUsd: costUsd,
      wasFallback: fetched.isFallback,
    },
  };
}

/**
 * 주간 수요 추천에 Amazon URL(+선택 USD 원가)을 붙여 몰테일·시세·시장성으로 갱신한다.
 */
export async function applyAmazonUrlToRecommendation(
  recommendationId: string,
  input: {
    url: string;
    costUsd?: number;
  },
) {
  const recommendation = await prisma.aiRecommendation.findUnique({
    where: { id: recommendationId },
    include: { candidate: true },
  });
  if (!recommendation) throw new Error("추천을 찾을 수 없습니다.");

  const breakdownRoot = recommendation.scoreBreakdown as {
    features?: { needsAmazonUrl?: boolean; naverKeyword?: string };
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

  if (!needsAmazonUrl) {
    throw new Error(
      "Amazon URL을 붙일 수 있는 수요 대기 추천이 아닙니다. 주간 발굴 카드에만 적용하세요.",
    );
  }

  let fetched = await fetchAmazonUsProduct(input.url);
  fetched = applyManualUsdCost(fetched, input.costUsd);

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
