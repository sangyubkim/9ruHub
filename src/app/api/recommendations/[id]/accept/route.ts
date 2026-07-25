import { NextResponse } from "next/server";
import { acceptRecommendation } from "@/lib/recommend/accept";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await acceptRecommendation(id);
    return NextResponse.json({
      item,
      draftId: item.draftId,
      next: item.draftId ? `/drafts/${item.draftId}` : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "수락 실패" },
      { status: 400 },
    );
  }
}
