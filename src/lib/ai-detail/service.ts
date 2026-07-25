import {
  Channel,
  DraftStatus,
  ListingStatus,
  Prisma,
  SourceMall,
} from "@/generated/prisma/client";
import { generateAiDetail } from "@/lib/ai-detail/generate";
import { optionsToJson } from "@/lib/ai-detail/prompts";
import type { AiDetailContent, AiDetailInput, AiDetailPreview } from "@/lib/ai-detail/types";
import { fetchAmazonUsProduct } from "@/lib/amazon/fetch-product";
import { extractAsin, isAmazonUsUrl } from "@/lib/amazon/parse-url";
import { prisma } from "@/lib/db";
import { DEFAULT_NOTICE } from "@/lib/draft/detail-template";
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
  const env = defaultPriceRuleFromEnv();
  if (!saved) return env;
  return {
    usdToKrw: Number(saved.usdToKrw),
    marginRate: Number(saved.marginRate),
    shippingFeeKrw: saved.shippingFeeKrw,
    agencyFeeKrw: saved.agencyFeeKrw,
    platformFeeRate: Number(saved.platformFeeRate),
    dutyRate: Number(saved.dutyRate),
    roundTo: saved.roundTo,
    chinaShippingFeeKrw: env.chinaShippingFeeKrw,
    intlShippingFeeKrw: env.intlShippingFeeKrw,
    cardFeeRate: env.cardFeeRate,
    minMarginRate: env.minMarginRate,
    undercutRate: env.undercutRate,
  };
}

function assertAmazonUrl(url: string) {
  if (!extractAsin(url)) {
    throw new Error("유효한 Amazon US URL 또는 ASIN이 필요합니다.");
  }
  if (!isAmazonUsUrl(url) && !/^[A-Z0-9]{10}$/i.test(url.trim())) {
    if (url.includes("://") && !isAmazonUsUrl(url)) {
      throw new Error("1차 버전은 Amazon US URL만 지원합니다.");
    }
  }
}

function buildAiMeta(content: AiDetailContent) {
  return {
    usedGpt: content.usedGpt,
    sourceLang: content.sourceLang,
    translationNote: content.translationNote,
    generatedAt: new Date().toISOString(),
  };
}

async function fetchAndPrice(url: string, tenantId: string) {
  assertAmazonUrl(url);
  const product = await fetchAmazonUsProduct(url);
  const rule = await getPriceRule(tenantId);
  const breakdown = calculateSalePrice(product.sourcePrice, rule);
  const input: AiDetailInput = {
    title: product.title,
    brand: product.brand,
    sourceUrl: product.sourceUrl,
    asin: product.asin,
    sourcePriceUsd: product.sourcePrice,
    salePriceKrw: breakdown.salePriceKrw,
    inStock: product.inStock,
    images: product.images,
    options: product.options,
    categoryHint: "해외구매대행",
    sourceLang: "en",
  };
  return { product, breakdown, input };
}

/** URL → AI 상세 미리보기 (DB 초안 미저장) */
export async function previewAiDetailFromUrl(
  url: string,
  tenantId?: string,
): Promise<AiDetailPreview> {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const { product, breakdown, input } = await fetchAndPrice(
    url,
    resolvedTenantId,
  );
  const content = await generateAiDetail(input);
  return {
    ...content,
    product: {
      asin: product.asin,
      sourceUrl: product.sourceUrl,
      title: product.title,
      brand: product.brand,
      sourcePriceUsd: product.sourcePrice,
      salePriceKrw: breakdown.salePriceKrw,
      inStock: product.inStock,
      images: product.images,
      isFallbackData: product.isFallback,
    },
  };
}

/** URL → AI 상세 생성 후 ProductDraft 저장 */
export async function createDraftWithAiDetail(
  url: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const { product, breakdown, input } = await fetchAndPrice(
    url,
    resolvedTenantId,
  );
  const content = await generateAiDetail(input);

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
      titleKo: content.titleKo,
      detailHtml: content.detailHtml,
      salePriceKrw: breakdown.salePriceKrw,
      costBreakdown: toJson(breakdown),
      images: toJson(product.images),
      options: toJson(optionsToJson(content.options)),
      keywords: toJson(content.keywords),
      noticeText: content.noticeText || DEFAULT_NOTICE,
      categoryHint: "해외구매대행",
      isFallbackData: product.isFallback,
      aiMeta: toJson(buildAiMeta(content)),
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
    titleKo: content.titleKo,
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

  return { draft, content };
}

/** 기존 초안에 AI 상세 재생성·저장 */
export async function regenerateAiDetailForDraft(
  draftId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const draft = await prisma.productDraft.findFirst({
    where: {
      id: draftId,
      tenantId: resolvedTenantId,
      status: { not: DraftStatus.ARCHIVED },
    },
    include: { sourceProduct: true },
  });
  if (!draft) throw new Error("초안을 찾을 수 없습니다.");

  const source = draft.sourceProduct;
  const images = Array.isArray(draft.images) ? (draft.images as string[]) : [];
  const rawOptions = Array.isArray(draft.options)
    ? (draft.options as Array<{ name: string; values: string[] }>)
    : Array.isArray(source.options)
      ? (source.options as Array<{ name: string; values: string[] }>)
      : [];

  const input: AiDetailInput = {
    title: source.title,
    brand: source.brand,
    sourceUrl: source.sourceUrl,
    asin: source.externalId,
    sourcePriceUsd: Number(source.sourcePrice),
    salePriceKrw: draft.salePriceKrw,
    inStock: source.inStock,
    images,
    options: rawOptions.map((o) => ({
      name: o.name,
      values: Array.isArray(o.values) ? o.values.map(String) : [],
    })),
    categoryHint: draft.categoryHint ?? "해외구매대행",
    sourceLang: source.currency === "CNY" ? "zh" : "en",
  };

  const content = await generateAiDetail(input);
  const updated = await prisma.productDraft.update({
    where: { id: draft.id },
    data: {
      titleKo: content.titleKo,
      detailHtml: content.detailHtml,
      options: toJson(optionsToJson(content.options)),
      keywords: toJson(content.keywords),
      noticeText: content.noticeText || draft.noticeText,
      aiMeta: toJson(buildAiMeta(content)),
    },
    include: { sourceProduct: true, listings: true },
  });

  return { draft: updated, content };
}
