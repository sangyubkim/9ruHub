import { NextRequest, NextResponse } from "next/server";
import {
  buildAnalyticsSnapshot,
  parseAnalyticsPeriod,
} from "@/lib/analytics/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const period = parseAnalyticsPeriod(req.nextUrl.searchParams.get("period"));
  const snapshot = await buildAnalyticsSnapshot(undefined, period);
  return NextResponse.json({
    snapshot,
    formulas: {
      revenue: "orders.subtotalKrw 합 (CANCELLED 제외)",
      profit: "orders.profitKrw 합",
      adSpend: "ad_spends.amountKrw 합 (기간 내)",
      roi: "순이익 / 광고비 (비율, UI는 ×100%)",
      refundRate: "환불 주문 수 / 판매 건수 (REFUNDED 또는 refundedKrw>0)",
    },
  });
}
