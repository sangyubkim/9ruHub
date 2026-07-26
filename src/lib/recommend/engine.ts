import {
  Prisma,
  ProductStatus,
  SourceMall,
} from "@/generated/prisma/client";
import { isAmazonFallbackTitle } from "@/lib/amazon/fallback";
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
  type ScoreBreakdown,
} from "@/lib/recommend/score";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asImageCount(images: unknown): number {
  return Array.isArray(images) ? images.length : 0;
}

export async function generateRecommendationsForTenant(options?: {
  tenantId?: string;
  limit?: number;
  minScore?: number;
}) {
  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const limit = options?.limit ?? 20;
  const minScore = options?.minScore ?? 40;

  // Amazon-first: 1688/시드 도매 오퍼 Product는 스캔하지 않음
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      sourceMall: SourceMall.AMAZON_US,
      status: {
        in: [
          ProductStatus.SOURCING,
          ProductStatus.DRAFTING,
          ProductStatus.LISTED,
        ],
      },
      NOT: {
        OR: [
          { title: { contains: "도매 오퍼" } },
          { titleKo: { contains: "도매 오퍼" } },
          { title: { contains: "[초안] Amazon US" } },
          { titleKo: { contains: "[초안] Amazon US" } },
          { sourceUrl: { contains: "1688.com" } },
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const created = [];

  for (const product of products) {
    if (created.length >= limit) break;
    if (
      isAmazonFallbackTitle(product.title) ||
      isAmazonFallbackTitle(product.titleKo)
    ) {
      continue;
    }

    const existing = await prisma.aiRecommendation.findFirst({
      where: {
        tenantId,
        productId: product.id,
        status: { in: ["PENDING", "ACCEPTED", "DRAFT_CREATED"] },
      },
    });
    if (existing) continue;

    const sourcePriceUsd = Number(product.sourcePrice);
    const priced = await priceAmazonUsProduct(tenantId, sourcePriceUsd);
    const market = await enrichAmazonMarket(
      {
        title: product.title,
        brand: product.brand,
        isFallback: false,
      },
      priced,
    );

    const breakdown = scoreCandidate({
      title: product.title,
      brand: product.brand,
      sourcePriceUsd,
      salePriceKrw: priced.salePriceKrw,
      costKrw: priced.costKrw,
      inStock: product.inStock,
      imageCount: asImageCount(product.images),
      alreadyListed: product.status === ProductStatus.LISTED,
      recentSales: product.totalSold,
    });

    if (breakdown.total < minScore) continue;

    const scorePayload = withAmazonScoreFeatures(
      breakdown,
      priced,
      sourcePriceUsd,
      {
        intlShippingKrw: priced.intlShippingKrw,
        competitorAvgKrw: market.competitorAvgKrw,
        minViableSaleKrw: priced.minViableSaleKrw,
        marketVerdict: market.marketVerdict,
        isFallback: false,
        naverKeyword: market.keyword,
      },
    );

    const copy = await generateRecommendCopy({
      title: product.titleKo ?? product.title,
      brand: product.brand,
      sourceUrl: product.sourceUrl,
      sourcePriceUsd,
      salePriceKrw: priced.salePriceKrw,
      costKrw: priced.costKrw,
      inStock: product.inStock,
      score: breakdown.total,
      scoreBreakdown: breakdown,
    });

    const row = await prisma.aiRecommendation.create({
      data: {
        tenantId,
        productId: product.id,
        draftId: product.draftId,
        sourceUrl: product.sourceUrl,
        externalId: product.externalId,
        title: product.titleKo ?? product.title,
        score: breakdown.total,
        scoreBreakdown: toJson(scorePayload),
        status: "PENDING",
        reasonCode: reasonCodeFromScore(breakdown.total),
        reasonText: copy.reasonText,
        detailHtml: copy.detailHtml,
      },
    });
    created.push({ ...row, usedGpt: copy.usedGpt, breakdown });
  }

  return {
    tenantId,
    scanned: products.length,
    created: created.length,
    items: created,
  };
}

export async function createRecommendationFromUrl(
  url: string,
  tenantId?: string,
) {
  const { fetchAmazonUsProduct } = await import("@/lib/amazon/fetch-product");
  const { SourceMall } = await import("@/generated/prisma/client");
  const { localizeTitle } = await import("@/lib/draft/detail-template");

  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const fetched = await fetchAmazonUsProduct(url);
  const priced = await priceAmazonUsProduct(
    resolvedTenantId,
    fetched.sourcePrice,
    fetched.weightGrams,
  );
  const market = await enrichAmazonMarket(fetched, priced);

  const sourceProduct = await prisma.sourceProduct.upsert({
    where: {
      tenantId_mall_externalId: {
        tenantId: resolvedTenantId,
        mall: SourceMall.AMAZON_US,
        externalId: fetched.asin,
      },
    },
    create: {
      tenantId: resolvedTenantId,
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
        tenantId: resolvedTenantId,
        sourceMall: SourceMall.AMAZON_US,
        externalId: fetched.asin,
      },
    },
    create: {
      tenantId: resolvedTenantId,
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
  const breakdown: ScoreBreakdown = scoreCandidate({
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

  const scorePayload = withAmazonScoreFeatures(
    breakdown,
    priced,
    sourcePriceUsd,
    {
      intlShippingKrw: priced.intlShippingKrw,
      competitorAvgKrw: market.competitorAvgKrw,
      minViableSaleKrw: priced.minViableSaleKrw,
      marketVerdict: market.marketVerdict,
      isFallback: fetched.isFallback,
      naverKeyword: market.keyword,
    },
  );

  let reasonCode = reasonCodeFromScore(breakdown.total);
  let score = breakdown.total;
  let reasonText: string;
  let detailHtml: string;
  let usedGpt = false;

  if (fetched.isFallback) {
    reasonCode = "FALLBACK";
    score = 0;
    reasonText =
      "Amazon 페이지에서 실제 제목·가격을 가져오지 못했습니다. 표시된 $29.99는 임시값입니다. 원본에서 실가를 확인한 뒤 URL을 다시 넣거나 초안에서 원가를 수정하세요.";
    detailHtml =
      "<section><h2>가격 확인 필요</h2><p>Amazon 차단/파싱 실패로 폴백 카드입니다. 실상품·실가로 재분석하세요.</p></section>";
  } else {
    const copy = await generateRecommendCopy({
      title: product.titleKo ?? product.title,
      brand: product.brand,
      sourceUrl: product.sourceUrl,
      sourcePriceUsd,
      salePriceKrw: priced.salePriceKrw,
      costKrw: priced.costKrw,
      inStock: product.inStock,
      score: breakdown.total,
      scoreBreakdown: breakdown,
    });
    reasonText = copy.reasonText;
    detailHtml = copy.detailHtml;
    usedGpt = copy.usedGpt;
  }

  const row = await prisma.aiRecommendation.create({
    data: {
      tenantId: resolvedTenantId,
      productId: product.id,
      sourceUrl: product.sourceUrl,
      externalId: product.externalId,
      title: product.titleKo ?? product.title,
      score,
      scoreBreakdown: toJson({ ...scorePayload, total: score }),
      status: "PENDING",
      reasonCode,
      reasonText,
      detailHtml,
    },
  });
  return { ...row, usedGpt };
}
