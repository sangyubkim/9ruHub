import { describe, expect, it } from "vitest";
import { RecommendationStatus } from "@/generated/prisma/client";
import {
  activeRecommendationWhere,
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
});
