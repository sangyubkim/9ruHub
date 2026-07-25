import { describe, expect, it } from "vitest";
import { DraftStatus } from "@/generated/prisma/client";
import { activeDraftWhere } from "@/lib/draft/filters";

describe("activeDraftWhere", () => {
  it("테넌트 범위에서 ARCHIVED를 제외한다", () => {
    expect(activeDraftWhere("tenant-1")).toEqual({
      tenantId: "tenant-1",
      status: { not: DraftStatus.ARCHIVED },
    });
  });
});
