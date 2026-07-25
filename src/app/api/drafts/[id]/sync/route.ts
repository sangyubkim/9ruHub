import { NextResponse } from "next/server";
import { syncDraftPriceStock } from "@/lib/sync/workflow";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await syncDraftPriceStock(id);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "동기화 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
