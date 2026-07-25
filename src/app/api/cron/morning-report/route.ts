import { NextResponse } from "next/server";
import { generateMorningReport } from "@/lib/analytics/morning-report";

/**
 * 매일 아침 스케줄러용 엔드포인트
 * Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateMorningReport({ force: true });
    return NextResponse.json({
      ok: true,
      reportId: result.report.id,
      usedGpt: result.report.usedGpt,
      insightCount: Array.isArray(result.report.insights)
        ? result.report.insights.length
        : 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "morning report failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
