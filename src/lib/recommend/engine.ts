import {
  Prisma,
  ProductStatus,
  SourceMall,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { calculateSalePrice, defaultPriceRuleFromEnv } from "@/lib/price-engine";
import { withAmazonScoreFeatures } from "@/lib/recommend/amazon-features";
import { generateRecommendCopy } from "@/lib/recommend/openai";
import {
  reasonCodeFromScore,
  scoreCandidate,
  type ScoreBreakdown,
} from "@/lib/recommend/score";
import { getDefaultTenantId, getTenantPriceRule } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asImageCount(images: unknown): number {
  return Array.isArray(images) ? images.length : 0;
}

async function resolveCostAndSale(
  tenantId: string,
  sourcePriceUsd: number,
  salePriceKrw?: number | null,
  costKrw?: number | null,
) {
  if (salePriceKrw != null && costKrw != null) {
    return { salePriceKrw, costKrw };
  }
  const ruleRow = await getTenantPriceRule(tenantId);
  const rule = ruleRow
    ? {
        usdToKrw: Number(ruleRow.usdToKrw),
        marginRate: Number(ruleRow.marginRate),
        shippingFeeKrw: ruleRow.shippingFeeKrw,
        agencyFeeKrw: ruleRow.agencyFeeKrw,
        platformFeeRate: Number(ruleRow.platformFeeRate),
        dutyRate: Number(ruleRow.dutyRate),
        roundTo: ruleRow.roundTo,
      }
    : defaultPriceRuleFromEnv();
  const breakdown = calculateSalePrice(sourcePriceUsd, rule);
  return {
    salePriceKrw: salePriceKrw ?? breakdown.salePriceKrw,
    costKrw:
      costKrw ??
      breakdown.sourcePriceKrw +
        breakdown.shippingFeeKrw +
        breakdown.agencyFeeKrw +
        breakdown.dutyKrw,
  };
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

    const existing = await prisma.aiRecommendation.findFirst({
      where: {
        tenantId,
        productId: product.id,
        status: { in: ["PENDING", "ACCEPTED", "DRAFT_CREATED"] },
      },
    });
    if (existing) continue;

    const sourcePriceUsd = Number(product.sourcePrice);
    const priced = await resolveCostAndSale(
      tenantId,
      sourcePriceUsd,
      product.salePriceKrw,
      product.costKrw,
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
  const priced = await resolveCostAndSale(
    resolvedTenantId,
    fetched.sourcePrice,
  );

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

  return prisma.aiRecommendation.create({
    data: {
      tenantId: resolvedTenantId,
      productId: product.id,
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
}
