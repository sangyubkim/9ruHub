import { describe, expect, it } from "vitest";
import {
  RecommendationStatus,
  SourceMall,
} from "@/generated/prisma/client";
import {
  activeRecommendationWhere,
  amazonFacingRecommendationWhere,
  ignoredRecommendationWhere,
  needsAmazonUrlExceptionWhere,
} from "@/lib/recommend/filters";

describe("recommendation filters", () => {
  it("기본 목록 where는 테넌트 범위에서 IGNORED를 제외한다", () => {
    expect(activeRecommendationWhere("tenant-1")).toEqual({
      tenantId: "tenant-1",
      status: { not: RecommendationStatus.IGNORED },
    });
  });

  it("무시된 목록 where는 IGNORED만 포함한다", () => {
    expect(ignoredRecommendationWhere("tenant-1")).toEqual({
      tenantId: "tenant-1",
      status: RecommendationStatus.IGNORED,
    });
  });

  it("needsAmazonUrl 예외는 DEMAND_WATCH·features.needsAmazonUrl을 포함한다", () => {
    expect(needsAmazonUrlExceptionWhere()).toEqual({
      OR: [
        { reasonCode: "DEMAND_WATCH" },
        {
          scoreBreakdown: {
            path: ["features", "needsAmazonUrl"],
            equals: true,
          },
        },
      ],
    });
  });

  it("Amazon-facing where는 stub 제외하되 needsAmazonUrl 카드를 OR로 포함한다", () => {
    const where = amazonFacingRecommendationWhere("tenant-1", false);
    expect(where).toMatchObject({
      AND: [
        {
          tenantId: "tenant-1",
          status: { not: RecommendationStatus.IGNORED },
        },
        {
          OR: [
            needsAmazonUrlExceptionWhere(),
            {
              NOT: {
                OR: expect.arrayContaining([
                  { candidate: { is: { isStub: true } } },
                  { title: { contains: "도매 오퍼" } },
                  { sourceUrl: { contains: "1688.com" } },
                  {
                    product: {
                      is: { sourceMall: { not: SourceMall.AMAZON_US } },
                    },
                  },
                ]),
              },
            },
          ],
        },
      ],
    });
  });
});
