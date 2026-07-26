import {
  RecommendationStatus,
  SourceMall,
  SupplyMall,
} from "@/generated/prisma/client";
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

/**
 * Amazon-first: 1688 stub·도매 오퍼 데모 카드 제외.
 * (후보 없는 Amazon URL 추천 / Amazon product 연결만)
 */
export function amazonFacingRecommendationWhere(
  tenantId: string,
  ignored: boolean,
): Prisma.AiRecommendationWhereInput {
  const base = ignored
    ? ignoredRecommendationWhere(tenantId)
    : activeRecommendationWhere(tenantId);

  return {
    AND: [
      base,
      {
        NOT: {
          OR: [
            { candidate: { is: { sourceSupplyMall: SupplyMall.MALL_1688 } } },
            { candidate: { is: { isStub: true } } },
            { title: { contains: "도매 오퍼" } },
            { sourceUrl: { contains: "1688.com" } },
            {
              product: {
                is: { sourceMall: { not: SourceMall.AMAZON_US } },
              },
            },
          ],
        },
      },
    ],
  };
}
