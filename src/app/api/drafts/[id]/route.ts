import { NextResponse } from "next/server";
import { z } from "zod";
import { DraftStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { archiveDraft } from "@/lib/draft/delete";
import { getDefaultTenantId } from "@/lib/tenant";

const updateSchema = z.object({
  titleKo: z.string().min(1).max(100).optional(),
  salePriceKrw: z.number().int().positive().optional(),
  detailHtml: z.string().min(1).optional(),
  noticeText: z.string().min(1).optional(),
  reviewNote: z.string().optional(),
  // ARCHIVED는 DELETE(soft-delete) 경로로만 설정
  status: z
    .nativeEnum(DraftStatus)
    .refine((s) => s !== DraftStatus.ARCHIVED, {
      message: "삭제는 DELETE /api/drafts/[id]를 사용하세요.",
    })
    .optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const tenantId = await getDefaultTenantId();
  const draft = await prisma.productDraft.findFirst({
    where: {
      id,
      tenantId,
      status: { not: DraftStatus.ARCHIVED },
    },
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
    const tenantId = await getDefaultTenantId();
    const existing = await prisma.productDraft.findFirst({
      where: {
        id,
        tenantId,
        status: { not: DraftStatus.ARCHIVED },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "초안을 찾을 수 없습니다." }, { status: 404 });
    }

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

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const draft = await archiveDraft(id);
    return NextResponse.json({ draft, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "삭제 실패";
    const status = message.includes("찾을 수 없") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
