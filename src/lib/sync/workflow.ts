import {
  Channel,
  DraftStatus,
  ListingStatus,
  Prisma,
  SyncJobStatus,
  SyncJobType,
} from "@/generated/prisma/client";
import { fetchAmazonUsProduct } from "@/lib/amazon/fetch-product";
import {
  getChannelAdapter,
  type ChannelProductMeta,
  type ChannelProductPayload,
} from "@/lib/channels";
import { prisma } from "@/lib/db";
import { calculateSalePrice, defaultPriceRuleFromEnv } from "@/lib/price-engine";
import { getTenantPriceRule } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asOptions(value: unknown): Array<{ name: string; values: string[] }> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as { name?: string; values?: string[] };
    return {
      name: String(row.name ?? "Option"),
      values: Array.isArray(row.values) ? row.values.map(String) : ["Default"],
    };
  });
}

function metaFromPayload(value: unknown): ChannelProductMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as {
    meta?: ChannelProductMeta;
    originProductNo?: string;
    channelProductNo?: string;
    sellerProductId?: string;
    vendorItemId?: string;
  };
  const meta = row.meta ?? {
    originProductNo: row.originProductNo,
    channelProductNo: row.channelProductNo,
    sellerProductId: row.sellerProductId,
    vendorItemId: row.vendorItemId,
  };
  if (
    !meta.originProductNo &&
    !meta.channelProductNo &&
    !meta.sellerProductId &&
    !meta.vendorItemId
  ) {
    return undefined;
  }
  return meta;
}

async function toPayload(
  draftId: string,
  listing?: { externalProductId: string | null; lastPayload: unknown },
): Promise<ChannelProductPayload> {
  const draft = await prisma.productDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { sourceProduct: true },
  });

  return {
    title: draft.titleKo,
    salePriceKrw: draft.salePriceKrw,
    detailHtml: draft.detailHtml,
    images: asStringArray(draft.images),
    options: asOptions(draft.options),
    noticeText: draft.noticeText,
    sourceUrl: draft.sourceProduct.sourceUrl,
    externalId: draft.sourceProduct.externalId,
    inStock: draft.sourceProduct.inStock,
    externalProductId: listing?.externalProductId ?? undefined,
    meta: metaFromPayload(listing?.lastPayload),
  };
}

export async function markReady(draftId: string) {
  return prisma.productDraft.update({
    where: { id: draftId },
    data: { status: DraftStatus.READY },
  });
}

export async function approveDraft(draftId: string) {
  const draft = await prisma.productDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (draft.status !== DraftStatus.DRAFT && draft.status !== DraftStatus.READY) {
    throw new Error(`승인 불가 상태: ${draft.status}`);
  }

  return prisma.productDraft.update({
    where: { id: draftId },
    data: {
      status: DraftStatus.APPROVED,
      approvedAt: new Date(),
    },
    include: { listings: true, sourceProduct: true },
  });
}

export async function publishApprovedDraft(draftId: string, channels?: Channel[]) {
  const draft = await prisma.productDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { listings: true },
  });

  if (draft.status !== DraftStatus.APPROVED && draft.status !== DraftStatus.PUBLISHED) {
    throw new Error("승인된 초안만 등록할 수 있습니다.");
  }

  await prisma.productDraft.update({
    where: { id: draftId },
    data: { status: DraftStatus.PUBLISHING },
  });

  const targetChannels = channels ?? [Channel.SMARTSTORE, Channel.COUPANG];
  const results = [];

  for (const channel of targetChannels) {
    const listing = draft.listings.find((l) => l.channel === channel);
    const payload = await toPayload(draftId, listing);
    const adapter = getChannelAdapter(channel);
    const result = await adapter.publish(payload);
    const storedPayload = toJson({
      ...result.payload,
      meta: result.meta ?? result.payload.meta,
      mode: result.mode,
    });

    await prisma.publishLog.create({
      data: {
        draftId,
        channel,
        success: result.success,
        message: result.message,
        payload: storedPayload,
      },
    });

    await prisma.channelListing.upsert({
      where: { draftId_channel: { draftId, channel } },
      create: {
        draftId,
        channel,
        status: result.success ? ListingStatus.LIVE : ListingStatus.FAILED,
        externalProductId: result.externalProductId,
        lastPayload: storedPayload,
        lastError: result.success ? null : result.message,
        lastSyncedAt: new Date(),
      },
      update: {
        status: result.success ? ListingStatus.LIVE : ListingStatus.FAILED,
        externalProductId: result.externalProductId,
        lastPayload: storedPayload,
        lastError: result.success ? null : result.message,
        lastSyncedAt: new Date(),
      },
    });

    results.push({ channel, ...result });
  }

  const allOk = results.every((r) => r.success);
  await prisma.productDraft.update({
    where: { id: draftId },
    data: {
      status: allOk ? DraftStatus.PUBLISHED : DraftStatus.APPROVED,
      publishedAt: allOk ? new Date() : null,
    },
  });

  return results;
}

export async function syncDraftPriceStock(draftId: string) {
  const draft = await prisma.productDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { sourceProduct: true, listings: true },
  });

  const job = await prisma.syncJob.create({
    data: {
      draftId,
      type: SyncJobType.FULL,
      status: SyncJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    const fresh = await fetchAmazonUsProduct(draft.sourceProduct.sourceUrl);
    const rule = await getTenantPriceRule(draft.tenantId);
    const envRule = defaultPriceRuleFromEnv();
    const priceRule = rule
      ? {
          usdToKrw: Number(rule.usdToKrw),
          marginRate: Number(rule.marginRate),
          shippingFeeKrw: rule.shippingFeeKrw,
          agencyFeeKrw: rule.agencyFeeKrw,
          platformFeeRate: Number(rule.platformFeeRate),
          dutyRate: Number(rule.dutyRate),
          roundTo: rule.roundTo,
          chinaShippingFeeKrw: envRule.chinaShippingFeeKrw,
          intlShippingFeeKrw: envRule.intlShippingFeeKrw,
          cardFeeRate: envRule.cardFeeRate,
          minMarginRate: envRule.minMarginRate,
          undercutRate: envRule.undercutRate,
        }
      : envRule;

    const breakdown = calculateSalePrice(fresh.sourcePrice, priceRule);

    await prisma.sourceProduct.update({
      where: { id: draft.sourceProductId },
      data: {
        sourcePrice: fresh.sourcePrice,
        inStock: fresh.inStock,
        title: fresh.title,
        images: toJson(fresh.images),
        options: toJson(fresh.options),
        fetchedAt: new Date(),
      },
    });

    await prisma.productDraft.update({
      where: { id: draftId },
      data: {
        salePriceKrw: breakdown.salePriceKrw,
        costBreakdown: toJson(breakdown),
        images: toJson(fresh.images),
        options: toJson(fresh.options),
      },
    });

    // canonical product + price history (SaaS analytics foundation)
    const linked = await prisma.product.findFirst({
      where: { tenantId: draft.tenantId, draftId },
    });
    if (linked) {
      const costKrw = Math.round(
        breakdown.sourcePriceKrw +
          breakdown.shippingFeeKrw +
          breakdown.agencyFeeKrw +
          breakdown.dutyKrw,
      );
      await prisma.product.update({
        where: { id: linked.id },
        data: {
          sourcePrice: fresh.sourcePrice,
          salePriceKrw: breakdown.salePriceKrw,
          costKrw,
          inStock: fresh.inStock,
          title: fresh.title,
          images: toJson(fresh.images),
        },
      });
      await prisma.productPriceHistory.create({
        data: {
          tenantId: draft.tenantId,
          productId: linked.id,
          sourcePrice: fresh.sourcePrice,
          salePriceKrw: breakdown.salePriceKrw,
          costKrw,
          currency: draft.sourceProduct.currency,
          inStock: fresh.inStock,
          note: "sync_price_stock",
        },
      });
    }

    const syncResults = [];

    for (const listing of draft.listings) {
      if (listing.status !== ListingStatus.LIVE) continue;
      const payload = await toPayload(draftId, listing);
      const adapter = getChannelAdapter(listing.channel);
      const result = await adapter.syncPriceStock({
        ...payload,
        inStock: fresh.inStock,
        salePriceKrw: breakdown.salePriceKrw,
      });
      syncResults.push({ channel: listing.channel, ...result });

      await prisma.channelListing.update({
        where: { id: listing.id },
        data: {
          // 동기화 실패 시에도 LIVE 유지 → 스케줄러가 재시도 가능
          status: fresh.inStock ? ListingStatus.LIVE : ListingStatus.SUSPENDED,
          lastSyncedAt: new Date(),
          lastError: result.success ? null : result.message,
        },
      });
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: SyncJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        message: `가격 ${breakdown.salePriceKrw}원 / 재고 ${fresh.inStock ? "있음" : "없음"}`,
      },
    });

    return {
      salePriceKrw: breakdown.salePriceKrw,
      inStock: fresh.inStock,
      syncResults,
    };
  } catch (error) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: SyncJobStatus.FAILED,
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : "동기화 실패",
      },
    });
    throw error;
  }
}
