import { describe, expect, it } from "vitest";
import { buildMorningInsights } from "./morning-insights";

describe("buildMorningInsights", () => {
  it("매출 증가율을 계산한다", () => {
    const insights = buildMorningInsights({
      yesterday: {
        orderCount: 58,
        revenueKrw: 4580000,
        profitKrw: 842000,
        refundedKrw: 0,
      },
      dayBefore: {
        orderCount: 40,
        revenueKrw: 3881356,
        profitKrw: 700000,
        refundedKrw: 0,
      },
      competitorDrops: [
        {
          productTitle: "A상품",
          dropKrw: 2000,
          previousKrw: 29900,
          currentKrw: 27900,
        },
      ],
      stockRisks: [
        {
          productTitle: "B상품",
          stockQty: 1,
          inStock: true,
          recentSold: 20,
        },
      ],
      adPauses: [
        {
          productTitle: "C상품",
          profitKrw: -5000,
          refundCount: 3,
          totalSold: 10,
          reason: "누적 순이익 적자",
        },
      ],
    });

    expect(insights.some((i) => i.kind === "SALES_CHANGE")).toBe(true);
    expect(insights.find((i) => i.kind === "SALES_CHANGE")?.message).toContain(
      "18%",
    );
    expect(
      insights.find((i) => i.kind === "COMPETITOR_PRICE")?.message,
    ).toContain("2,000원");
    expect(insights.find((i) => i.kind === "STOCK_RISK")?.message).toContain(
      "재고 부족",
    );
    expect(insights.find((i) => i.kind === "AD_PAUSE")?.message).toContain(
      "광고를 중단",
    );
  });
});
