import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createDraftFromUrl } from "@/lib/draft/create-from-url";

const createSchema = z.object({
  url: z.string().min(3),
});

export async function GET() {
  const drafts = await prisma.productDraft.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sourceProduct: true,
      listings: true,
    },
    take: 100,
  });
  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const draft = await createDraftFromUrl(body.url);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "초안 생성 실패";
    const status = message.includes("지원") || message.includes("유효") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
