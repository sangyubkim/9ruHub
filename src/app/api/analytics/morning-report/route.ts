import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateMorningReport,
  getLatestMorningReport,
  listMorningReports,
} from "@/lib/analytics/morning-report";

const postSchema = z.object({
  force: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "1";
    if (all) {
      const reports = await listMorningReports();
      return NextResponse.json({ reports });
    }
    const report = await getLatestMorningReport();
    return NextResponse.json({ report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "아침 보고서 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = postSchema.parse(await request.json().catch(() => ({})));
    const result = await generateMorningReport({ force: body.force });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "아침 보고서 생성 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
