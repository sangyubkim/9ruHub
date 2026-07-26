import { NextResponse } from "next/server";
import { deleteRecommendation } from "@/lib/recommend/cleanup";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await deleteRecommendation(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "삭제 실패",
      },
      { status: 400 },
    );
  }
}
