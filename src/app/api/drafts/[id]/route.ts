import { NextResponse } from "next/server";
import { z } from "zod";
import { DraftStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  titleKo: z.string().min(1).max(100).optional(),
  salePriceKrw: z.number().int().positive().optional(),
  detailHtml: z.string().min(1).optional(),
  noticeText: z.string().min(1).optional(),
  reviewNote: z.string().optional(),
  status: z.nativeEnum(DraftStatus).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const draft = await prisma.productDraft.findUnique({
    where: { id },
    include: {
      sourceProduct: true,
      listings: true,
      publishLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      syncJobs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "초안을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ draft });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const draft = await prisma.productDraft.update({
      where: { id },
      data: body,
      include: { sourceProduct: true, listings: true },
    });
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "수정 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
