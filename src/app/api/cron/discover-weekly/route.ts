import { NextResponse } from "next/server";
import { runWeeklyDiscover } from "@/lib/discover/weekly-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 주간 자동 발굴 스케줄러
 * Authorization: Bearer $CRON_SECRET
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const cronHeader = request.headers.get("x-cron-secret") ?? "";
  if (
    secret &&
    auth !== `Bearer ${secret}` &&
    cronHeader !== secret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expandRelated =
      (process.env.DISCOVER_WEEKLY_EXPAND_RELATED ?? "false").toLowerCase() ===
      "true";
    const envMode = process.env.DISCOVER_WEEKLY_SUPPLY_MODE?.trim();
    const supplyMode =
      envMode === "legacy_1688" ? ("legacy_1688" as const) : ("demand_only" as const);
    const result = await runWeeklyDiscover({
      category: "all",
      expandRelated,
      supplyMode,
      supplyLimit: Number(process.env.DISCOVER_WEEKLY_SUPPLY_LIMIT ?? 1),
      minScore: Number(process.env.DISCOVER_WEEKLY_MIN_SCORE ?? 40),
      delayMs: Number(process.env.DISCOVER_WEEKLY_DELAY_MS ?? 300),
    });

    return NextResponse.json({
      ok: true,
      supplyMode: result.supplyMode,
      scanned: result.scanned,
      createdTotal: result.createdTotal,
      awaitingAmazonCount: result.awaitingAmazonCount,
      relatedCount: result.relatedCount,
      top: result.top.slice(0, 10),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "discover-weekly failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
