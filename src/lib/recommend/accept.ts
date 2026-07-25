import { RecommendationStatus } from "@/generated/prisma/client";
import { regenerateAiDetailForDraft } from "@/lib/ai-detail/service";
import { prisma } from "@/lib/db";
import { createDraftFromCandidate } from "@/lib/draft/create-from-candidate";
import { createDraftFromUrl } from "@/lib/draft/create-from-url";
import { getDefaultTenantId } from "@/lib/tenant";

/**
 * 원클릭: 추천 수락 → 초안 확보(기존 draft 재사용 또는 URL/발굴후보로 생성) → DRAFT_CREATED
 * 새로 만든 초안에는 AI 상세(제목/키워드/HTML/옵션)를 한 번 적용한다.
 */
export async function acceptRecommendation(
  recommendationId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const rec = await prisma.aiRecommendation.findFirst({
    where: { id: recommendationId, tenantId: resolvedTenantId },
    include: { product: true, draft: true, candidate: true },
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
  let createdFresh = false;

  if (!draftId) {
    if (rec.candidateId) {
      const draft = await createDraftFromCandidate(
        rec.candidateId,
        resolvedTenantId,
      );
      draftId = draft.id;
      createdFresh = true;
    } else {
      const url = rec.sourceUrl ?? rec.product?.sourceUrl;
      if (!url) throw new Error("초안 생성에 필요한 sourceUrl이 없습니다.");
      // Amazon URL 수락 시 AI 상세까지 생성
      const draft = await createDraftFromUrl(url, resolvedTenantId, {
        generateAi: true,
      });
      draftId = draft.id;
      createdFresh = true;
    }
  }

  // 발굴 후보 초안은 생성 직후 AI 상세로 보강
  if (createdFresh && rec.candidateId) {
    try {
      await regenerateAiDetailForDraft(draftId, resolvedTenantId);
    } catch (error) {
      console.warn("acceptRecommendation AI detail skipped", error);
    }
  }

  const updated = await prisma.aiRecommendation.update({
    where: { id: rec.id },
    data: {
      status: RecommendationStatus.DRAFT_CREATED,
      draftId,
      acceptedAt: new Date(),
    },
    include: { draft: true, product: true, candidate: true },
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

/**
 * 무시 취소 → 열린 상태(PENDING)로 복구. 메인 목록에 다시 표시됨.
 * (스키마에 previousStatus 없음 — 무시 전 기본 열린 상태는 PENDING)
 */
export async function unignoreRecommendation(
  recommendationId: string,
  tenantId?: string,
) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  const rec = await prisma.aiRecommendation.findFirst({
    where: { id: recommendationId, tenantId: resolvedTenantId },
  });
  if (!rec) throw new Error("추천을 찾을 수 없습니다.");
  if (rec.status !== RecommendationStatus.IGNORED) {
    throw new Error(`무시 취소할 수 없는 상태: ${rec.status}`);
  }

  return prisma.aiRecommendation.update({
    where: { id: rec.id },
    data: {
      status: RecommendationStatus.PENDING,
      ignoredAt: null,
    },
  });
}
