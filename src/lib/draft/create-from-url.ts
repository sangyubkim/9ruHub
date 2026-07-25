import {
  Channel,
  DraftStatus,
  ListingStatus,
  Prisma,
  SourceMall,
} from "@/generated/prisma/client";
import { fetchAmazonUsProduct } from "@/lib/amazon/fetch-product";
import { isAmazonUsUrl, extractAsin } from "@/lib/amazon/parse-url";
import { prisma } from "@/lib/db";
import {
  DEFAULT_NOTICE,
  localizeTitle,
  renderDetailHtml,
} from "@/lib/draft/detail-template";
import {
  calculateSalePrice,
  defaultPriceRuleFromEnv,
  type PriceRuleInput,
} from "@/lib/price-engine";
import {
  getDefaultTenantId,
  getTenantPriceRule,
  upsertProductFromDraft,
} from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function getPriceRule(tenantId: string): Promise<PriceRuleInput> {
  const saved = await getTenantPriceRule(tenantId);
  if (!saved) return defaultPriceRuleFromEnv();
  return {
    usdToKrw: Number(saved.usdToKrw),
    marginRate: Number(saved.marginRate),
    shippingFeeKrw: saved.shippingFeeKrw,
    agencyFeeKrw: saved.agencyFeeKrw,
    platformFeeRate: Number(saved.platformFeeRate),
    dutyRate: Number(saved.dutyRate),
    roundTo: saved.roundTo,
  };
}

export async function createDraftFromUrl(url: string, tenantId?: string) {
  if (!extractAsin(url)) {
    throw new Error("유효한 Amazon US URL 또는 ASIN이 필요합니다.");
  }
  if (!isAmazonUsUrl(url) && !/^[A-Z0-9]{10}$/i.test(url.trim())) {
    if (url.includes("://") && !isAmazonUsUrl(url)) {
      throw new Error("1차 버전은 Amazon US URL만 지원합니다.");
    }
  }

  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const product = await fetchAmazonUsProduct(url);
  const rule = await getPriceRule(resolvedTenantId);
  const breakdown = calculateSalePrice(product.sourcePrice, rule);
  const titleKo = localizeTitle(product.title, product.brand);
  const detailHtml = renderDetailHtml(product, breakdown, DEFAULT_NOTICE);

  const sourceProduct = await prisma.sourceProduct.upsert({
    where: {
      tenantId_mall_externalId: {
        tenantId: resolvedTenantId,
        mall: SourceMall.AMAZON_US,
        externalId: product.asin,
      },
    },
    create: {
      tenantId: resolvedTenantId,
      mall: SourceMall.AMAZON_US,
      sourceUrl: product.sourceUrl,
      externalId: product.asin,
      title: product.title,
      brand: product.brand,
      currency: product.currency,
      sourcePrice: product.sourcePrice,
      inStock: product.inStock,
      images: toJson(product.images),
      options: toJson(product.options),
      rawPayload: product.raw ? toJson(product.raw) : undefined,
    },
    update: {
      sourceUrl: product.sourceUrl,
      title: product.title,
      brand: product.brand,
      currency: product.currency,
      sourcePrice: product.sourcePrice,
      inStock: product.inStock,
      images: toJson(product.images),
      options: toJson(product.options),
      rawPayload: product.raw ? toJson(product.raw) : undefined,
      fetchedAt: new Date(),
    },
  });

  const draft = await prisma.productDraft.create({
    data: {
      tenantId: resolvedTenantId,
      status: DraftStatus.DRAFT,
      sourceProductId: sourceProduct.id,
      titleKo,
      detailHtml,
      salePriceKrw: breakdown.salePriceKrw,
      costBreakdown: toJson(breakdown),
      images: toJson(product.images),
      options: toJson(product.options),
      noticeText: DEFAULT_NOTICE,
      categoryHint: "해외구매대행",
      isFallbackData: product.isFallback,
      listings: {
        create: [
          { channel: Channel.SMARTSTORE, status: ListingStatus.NOT_CREATED },
          { channel: Channel.COUPANG, status: ListingStatus.NOT_CREATED },
        ],
      },
    },
    include: {
      sourceProduct: true,
      listings: true,
    },
  });

  await upsertProductFromDraft({
    tenantId: resolvedTenantId,
    sourceProductId: sourceProduct.id,
    draftId: draft.id,
    title: product.title,
    titleKo,
    brand: product.brand,
    sourceMall: SourceMall.AMAZON_US,
    sourceUrl: product.sourceUrl,
    externalId: product.asin,
    currency: product.currency,
    sourcePrice: product.sourcePrice,
    salePriceKrw: breakdown.salePriceKrw,
    costKrw: Math.round(
      breakdown.sourcePriceKrw +
        breakdown.shippingFeeKrw +
        breakdown.agencyFeeKrw +
        breakdown.dutyKrw,
    ),
    inStock: product.inStock,
    images: toJson(product.images),
  });

  return draft;
}
