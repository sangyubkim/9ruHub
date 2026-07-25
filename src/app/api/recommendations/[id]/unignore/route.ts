import { NextResponse } from "next/server";
import { unignoreRecommendation } from "@/lib/recommend/accept";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await unignoreRecommendation(id);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "무시 취소 실패" },
      { status: 400 },
    );
  }
}
