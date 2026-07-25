import { DraftStatus, type Prisma } from "@/generated/prisma/client";

/** 기본 초안 목록에서 ARCHIVED(삭제)를 제외한다. */
export function activeDraftWhere(
  tenantId: string,
): Prisma.ProductDraftWhereInput {
  return {
    tenantId,
    status: { not: DraftStatus.ARCHIVED },
  };
}
