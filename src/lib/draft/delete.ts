import { DraftStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

export { activeDraftWhere } from "@/lib/draft/filters";

/**
 * 초안 soft-delete: status → ARCHIVED.
 * 연결된 AI 추천의 draftId는 해제해 UI 깨짐을 방지한다.
 */
export async function archiveDraft(draftId: string, tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());

  const draft = await prisma.productDraft.findFirst({
    where: { id: draftId, tenantId: resolvedTenantId },
  });

  if (!draft) {
    throw new Error("초안을 찾을 수 없습니다.");
  }

  if (draft.status === DraftStatus.ARCHIVED) {
    return draft;
  }

  return prisma.$transaction(async (tx) => {
    await tx.aiRecommendation.updateMany({
      where: { tenantId: resolvedTenantId, draftId },
      data: { draftId: null },
    });

    return tx.productDraft.update({
      where: { id: draftId },
      data: { status: DraftStatus.ARCHIVED },
    });
  });
}
