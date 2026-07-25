import {
  Channel,
  DraftStatus,
  ListingStatus,
  Prisma,
  SourceMall,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_NOTICE } from "@/lib/draft/detail-template";
import { getDefaultTenantId, upsertProductFromDraft } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * 발굴 후보(메타데이터)로 ProductDraft 생성 — Amazon fetch 없이 1688/네이버 필드만 사용.
 */
export async function createDraftFromCandidate(
  candidateId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const candidate = await prisma.productCandidate.findFirst({
    where: { id: candidateId, tenantId: resolvedTenantId },
  });
  if (!candidate) throw new Error("발굴 후보를 찾을 수 없습니다.");

  const externalId =
    candidate.externalSupplyId ??
    candidate.externalDemandId ??
    `cand-${candidate.id.slice(0, 10)}`;
  const sourceUrl =
    candidate.supplyUrl ??
    candidate.demandUrl ??
    `discover://${candidate.keyword}`;
  const costCny = candidate.costPrice ? Number(candidate.costPrice) : 0;
  const sellPriceKrw = candidate.sellPrice ?? 0;
  const cnyToKrw = Number(process.env.CNY_TO_KRW ?? 190);
  const sourcePriceUsdApprox = costCny > 0 ? (costCny * cnyToKrw) / 1380 : 1;

  const sourceProduct = await prisma.sourceProduct.upsert({
    where: {
      tenantId_mall_externalId: {
        tenantId: resolvedTenantId,
        mall: SourceMall.OTHER,
        externalId,
      },
    },
    create: {
      tenantId: resolvedTenantId,
      mall: SourceMall.OTHER,
      sourceUrl,
      externalId,
      title: candidate.title,
      brand: null,
      currency: "CNY",
      sourcePrice: costCny || sourcePriceUsdApprox,
      inStock: true,
      images: toJson([]),
      options: toJson([]),
      rawPayload: toJson({
        fromCandidateId: candidate.id,
        keyword: candidate.keyword,
        demandMall: candidate.sourceDemandMall,
        supplyMall: candidate.sourceSupplyMall,
        isStub: candidate.isStub,
      }),
    },
    update: {
      sourceUrl,
      title: candidate.title,
      sourcePrice: costCny || sourcePriceUsdApprox,
      currency: "CNY",
      fetchedAt: new Date(),
      rawPayload: toJson({
        fromCandidateId: candidate.id,
        keyword: candidate.keyword,
        demandMall: candidate.sourceDemandMall,
        supplyMall: candidate.sourceSupplyMall,
        isStub: candidate.isStub,
      }),
    },
  });

  const detailHtml = `
<section>
  <h2>[구매대행] ${escapeHtml(candidate.title)}</h2>
  <p>키워드 발굴 후보에서 생성된 초안입니다.</p>
  <ul>
    <li>키워드: ${escapeHtml(candidate.keyword)}</li>
    <li>수요몰: ${candidate.sourceDemandMall}</li>
    <li>공급몰: ${candidate.sourceSupplyMall}</li>
    <li>원가(CNY): ¥${costCny}</li>
    <li>예상 판매가: ${sellPriceKrw.toLocaleString("ko-KR")}원</li>
  </ul>
  ${
    candidate.supplyUrl
      ? `<p>공급 링크: <a href="${escapeHtml(candidate.supplyUrl)}" target="_blank" rel="noreferrer">1688</a></p>`
      : ""
  }
  <p>${DEFAULT_NOTICE}</p>
</section>
`.trim();

  const draft = await prisma.productDraft.create({
    data: {
      tenantId: resolvedTenantId,
      status: DraftStatus.DRAFT,
      sourceProductId: sourceProduct.id,
      titleKo: candidate.title,
      detailHtml,
      salePriceKrw: sellPriceKrw,
      costBreakdown: toJson({
        mode: "discover-candidate",
        costPriceCny: costCny,
        marginRate: candidate.marginRate ? Number(candidate.marginRate) : null,
        sellPriceKrw,
        isStub: candidate.isStub,
      }),
      images: toJson([]),
      options: toJson([]),
      noticeText: DEFAULT_NOTICE,
      categoryHint: "키워드발굴",
      isFallbackData: candidate.isStub,
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

  const landedCostKrw = Math.round(
    costCny * cnyToKrw * Number(process.env.DISCOVER_LANDED_MULTIPLIER ?? 1.45),
  );

  await upsertProductFromDraft({
    tenantId: resolvedTenantId,
    sourceProductId: sourceProduct.id,
    draftId: draft.id,
    title: candidate.title,
    titleKo: candidate.title,
    brand: null,
    sourceMall: SourceMall.OTHER,
    sourceUrl,
    externalId,
    currency: "CNY",
    sourcePrice: costCny || sourcePriceUsdApprox,
    salePriceKrw: sellPriceKrw,
    costKrw: landedCostKrw || Math.round(sellPriceKrw * 0.65),
    inStock: true,
    images: toJson([]),
  });

  return draft;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
