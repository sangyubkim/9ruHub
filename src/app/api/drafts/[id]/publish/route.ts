import { NextResponse } from "next/server";
import { z } from "zod";
import { Channel } from "@/generated/prisma/client";
import { publishApprovedDraft } from "@/lib/sync/workflow";

const schema = z.object({
  channels: z.array(z.nativeEnum(Channel)).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const results = await publishApprovedDraft(id, body.channels);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "등록 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
