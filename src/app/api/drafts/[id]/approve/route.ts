import { NextResponse } from "next/server";
import { approveDraft } from "@/lib/sync/workflow";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const draft = await approveDraft(id);
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "승인 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
