import { RecommendationStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

/** 기본 목록: IGNORED 제외 (테넌트 범위) */
export function activeRecommendationWhere(
  tenantId: string,
): Prisma.AiRecommendationWhereInput {
  return {
    tenantId,
    status: { not: RecommendationStatus.IGNORED },
  };
}

/** 무시된 항목만 (테넌트 범위) */
export function ignoredRecommendationWhere(
  tenantId: string,
): Prisma.AiRecommendationWhereInput {
  return {
    tenantId,
    status: RecommendationStatus.IGNORED,
  };
}
