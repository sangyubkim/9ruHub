import { describe, expect, it } from "vitest";
import {
  RecommendationStatus,
  SourceMall,
  SupplyMall,
} from "@/generated/prisma/client";
import {
  activeRecommendationWhere,
  amazonFacingRecommendationWhere,
  ignoredRecommendationWhere,
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

  it("Amazon-facing where는 1688 stub·도매 오퍼를 제외한다", () => {
    const where = amazonFacingRecommendationWhere("tenant-1", false);
    expect(where).toMatchObject({
      AND: [
        {
          tenantId: "tenant-1",
          status: { not: RecommendationStatus.IGNORED },
        },
        {
          NOT: {
            OR: expect.arrayContaining([
              {
                candidate: {
                  is: { sourceSupplyMall: SupplyMall.MALL_1688 },
                },
              },
              { title: { contains: "도매 오퍼" } },
              {
                product: {
                  is: { sourceMall: { not: SourceMall.AMAZON_US } },
                },
              },
            ]),
          },
        },
      ],
    });
  });
});
