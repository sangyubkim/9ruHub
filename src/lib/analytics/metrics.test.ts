import { describe, expect, it } from "vitest";
import {
  aggregateRevenueMetrics,
  computeRefundRate,
  computeRoi,
  isRefundedOrder,
  parseAnalyticsPeriod,
  resolvePeriodRange,
  type RevenueMetrics,
} from "@/lib/analytics/kpi";

describe("analytics metric formulas", () => {
  it("ROI = 순이익 / 광고비 (광고비 0이면 0)", () => {
    expect(computeRoi(842_000, 120_000)).toBeCloseTo(842_000 / 120_000, 6);
    expect(computeRoi(842_000, 0)).toBe(0);
    expect(computeRoi(0, 100)).toBe(0);
  });

  it("환불률 = 환불 주문 수 / 전체 주문 수", () => {
    expect(computeRefundRate(1, 58)).toBeCloseTo(1 / 58, 6);
    expect(computeRefundRate(0, 10)).toBe(0);
    expect(computeRefundRate(3, 0)).toBe(0);
  });

  it("REFUNDED 상태 또는 refundedKrw > 0 이면 환불 주문", () => {
    expect(isRefundedOrder({ status: "REFUNDED", refundedKrw: 0 })).toBe(true);
    expect(isRefundedOrder({ status: "PAID", refundedKrw: 5000 })).toBe(true);
    expect(isRefundedOrder({ status: "DELIVERED", refundedKrw: 0 })).toBe(
      false,
    );
  });

  it("aggregateRevenueMetrics가 필수 KPI를 계산", () => {
    const revenue: RevenueMetrics = aggregateRevenueMetrics(
      [
        {
          status: "PAID",
          subtotalKrw: 100_000,
          costKrw: 40_000,
          platformFeeKrw: 5_000,
          shippingFeeKrw: 3_000,
          profitKrw: 52_000,
          refundedKrw: 0,
        },
        {
          status: "REFUNDED",
          subtotalKrw: 50_000,
          costKrw: 20_000,
          platformFeeKrw: 2_000,
          shippingFeeKrw: 0,
          profitKrw: 0,
          refundedKrw: 50_000,
        },
      ],
      20_000,
    );

    expect(revenue.orderCount).toBe(2);
    expect(revenue.subtotalKrw).toBe(150_000);
    expect(revenue.profitKrw).toBe(52_000);
    expect(revenue.adSpendKrw).toBe(20_000);
    expect(revenue.roi).toBeCloseTo(52_000 / 20_000, 6);
    expect(revenue.refundedOrderCount).toBe(1);
    expect(revenue.refundRate).toBeCloseTo(0.5, 6);
    expect(revenue.marginRate).toBeCloseTo(52_000 / 150_000, 6);
  });

  it("parseAnalyticsPeriod 기본값은 today", () => {
    expect(parseAnalyticsPeriod(undefined)).toBe("today");
    expect(parseAnalyticsPeriod("7d")).toBe("7d");
    expect(parseAnalyticsPeriod("nope")).toBe("today");
  });

  it("resolvePeriodRange(today)는 서울 당일 자정~다음날 자정(배타)", () => {
    const now = new Date("2026-07-26T10:00:00+09:00");
    const { start, end } = resolvePeriodRange("today", now);
    expect(start?.toISOString()).toBe(
      new Date("2026-07-26T00:00:00+09:00").toISOString(),
    );
    expect(end.toISOString()).toBe(
      new Date("2026-07-27T00:00:00+09:00").toISOString(),
    );
  });
});
