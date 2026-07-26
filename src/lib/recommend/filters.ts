import {
  RecommendationStatus,
  SourceMall,
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

/** 주간 수요 카드(Amazon URL 대기) — stub 제외 필터의 예외 */
export function needsAmazonUrlExceptionWhere(): Prisma.AiRecommendationWhereInput {
  return {
    OR: [
      { reasonCode: "DEMAND_WATCH" },
      {
        scoreBreakdown: {
          path: ["features", "needsAmazonUrl"],
          equals: true,
        },
      },
    ],
  };
}

/**
 * Amazon-first: 1688 stub·도매 오퍼 데모 카드 제외.
 * 주간 수요 카드(needsAmazonUrl / DEMAND_WATCH)는 예외로 목록에 포함.
 * Amazon URL을 붙인 뒤(isStub=false·product=AMAZON_US)도 계속 노출.
 */
export function amazonFacingRecommendationWhere(
  tenantId: string,
  ignored: boolean,
): Prisma.AiRecommendationWhereInput {
  const base = ignored
    ? ignoredRecommendationWhere(tenantId)
    : activeRecommendationWhere(tenantId);

  const chinaOrStubExclusions: Prisma.AiRecommendationWhereInput = {
    OR: [
      { candidate: { is: { isStub: true } } },
      { title: { contains: "도매 오퍼" } },
      { sourceUrl: { contains: "1688.com" } },
      {
        product: {
          is: { sourceMall: { not: SourceMall.AMAZON_US } },
        },
      },
    ],
  };

  return {
    AND: [
      base,
      {
        OR: [
          needsAmazonUrlExceptionWhere(),
          { NOT: chinaOrStubExclusions },
        ],
      },
    ],
  };
}
