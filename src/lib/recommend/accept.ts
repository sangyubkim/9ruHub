import { RecommendationStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createDraftFromUrl } from "@/lib/draft/create-from-url";
import { getDefaultTenantId } from "@/lib/tenant";

/**
 * 원클릭: 추천 수락 → 초안 확보(기존 draft 재사용 또는 URL로 생성) → DRAFT_CREATED
 */
export async function acceptRecommendation(
  recommendationId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const rec = await prisma.aiRecommendation.findFirst({
    where: { id: recommendationId, tenantId: resolvedTenantId },
    include: { product: true, draft: true },
  });
  if (!rec) throw new Error("추천을 찾을 수 없습니다.");
  if (
    rec.status === RecommendationStatus.IGNORED ||
    rec.status === RecommendationStatus.DRAFT_CREATED ||
    rec.status === RecommendationStatus.CONVERTED
  ) {
    throw new Error(`처리할 수 없는 상태: ${rec.status}`);
  }

  let draftId = rec.draftId ?? rec.product?.draftId ?? null;

  if (!draftId) {
    const url = rec.sourceUrl ?? rec.product?.sourceUrl;
    if (!url) throw new Error("초안 생성에 필요한 sourceUrl이 없습니다.");
    const draft = await createDraftFromUrl(url, resolvedTenantId);
    draftId = draft.id;
  }

  const updated = await prisma.aiRecommendation.update({
    where: { id: rec.id },
    data: {
      status: RecommendationStatus.DRAFT_CREATED,
      draftId,
      acceptedAt: new Date(),
    },
    include: { draft: true, product: true },
  });

  return updated;
}

export async function ignoreRecommendation(
  recommendationId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const rec = await prisma.aiRecommendation.findFirst({
    where: { id: recommendationId, tenantId: resolvedTenantId },
  });
  if (!rec) throw new Error("추천을 찾을 수 없습니다.");

  return prisma.aiRecommendation.update({
    where: { id: rec.id },
    data: {
      status: RecommendationStatus.IGNORED,
      ignoredAt: new Date(),
    },
  });
}
