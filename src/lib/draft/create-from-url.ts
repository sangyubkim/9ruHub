import {
  Channel,
  DraftStatus,
  ListingStatus,
  Prisma,
  SourceMall,
} from "@/generated/prisma/client";
import { generateAiDetail } from "@/lib/ai-detail/generate";
import { optionsToJson } from "@/lib/ai-detail/prompts";
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

export type CreateDraftFromUrlOptions = {
  /** true면 GPT/템플릿으로 제목·키워드·상세·옵션 생성 */
  generateAi?: boolean;
};

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

export async function createDraftFromUrl(
  url: string,
  tenantId?: string,
  options: CreateDraftFromUrlOptions = {},
) {
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
  const { estimateIntlShipping } = await import(
    "@/lib/forwarder/shipping-estimate"
  );
  const shippingQuote = estimateIntlShipping({ region: "US" });
  const ruleWithMalltail = {
    ...rule,
    chinaShippingFeeKrw: rule.chinaShippingFeeKrw ?? 0,
    intlShippingFeeKrw: shippingQuote.feeKrw,
    shippingFeeKrw: shippingQuote.feeKrw,
  };
  const breakdown = {
    ...calculateSalePrice(product.sourcePrice, ruleWithMalltail),
    shippingQuote,
  };

  let titleKo = localizeTitle(product.title, product.brand);
  let detailHtml = renderDetailHtml(product, breakdown, DEFAULT_NOTICE);
  let draftOptions: unknown = product.options;
  let keywords: string[] | undefined;
  let noticeText = DEFAULT_NOTICE;
  let aiMeta: Record<string, unknown> | undefined;

  if (options.generateAi) {
    const ai = await generateAiDetail({
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
    });
    titleKo = ai.titleKo;
    detailHtml = ai.detailHtml;
    draftOptions = optionsToJson(ai.options);
    keywords = ai.keywords;
    noticeText = ai.noticeText || DEFAULT_NOTICE;
    aiMeta = {
      usedGpt: ai.usedGpt,
      sourceLang: ai.sourceLang,
      translationNote: ai.translationNote,
      generatedAt: new Date().toISOString(),
    };
  }

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
      options: toJson(draftOptions),
      keywords: keywords ? toJson(keywords) : undefined,
      noticeText,
      categoryHint: "해외구매대행",
      isFallbackData: product.isFallback,
      aiMeta: aiMeta ? toJson(aiMeta) : undefined,
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
