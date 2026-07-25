import { NextResponse } from "next/server";
import { buildAnalyticsSnapshot } from "@/lib/analytics/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildAnalyticsSnapshot();
  return NextResponse.json({ snapshot });
}
