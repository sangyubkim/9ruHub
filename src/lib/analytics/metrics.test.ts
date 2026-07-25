import { describe, expect, it } from "vitest";
import type { AnalyticsSnapshot } from "@/lib/analytics/metrics";

describe("analytics snapshot shape", () => {
  it("documents required revenue fields for ops assistant RAG", () => {
    const sample: AnalyticsSnapshot = {
      tenantId: "t1",
      generatedAt: new Date().toISOString(),
      revenue: {
        orderCount: 0,
        subtotalKrw: 0,
        costKrw: 0,
        platformFeeKrw: 0,
        shippingFeeKrw: 0,
        profitKrw: 0,
        marginRate: 0,
        refundedKrw: 0,
      },
      topProducts: [],
      recommendations: {
        total: 0,
        pending: 0,
        acceptedOrDrafted: 0,
        ignored: 0,
        avgScore: 0,
        conversionRate: 0,
      },
    };
    expect(sample.revenue.orderCount).toBe(0);
    expect(sample.recommendations.conversionRate).toBe(0);
  });
});
