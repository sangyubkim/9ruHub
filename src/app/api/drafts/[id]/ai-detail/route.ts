import { NextResponse } from "next/server";
import { regenerateAiDetailForDraft } from "@/lib/ai-detail/service";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/drafts/:id/ai-detail — AI 상세 재생성 후 초안 갱신
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { draft, content } = await regenerateAiDetailForDraft(id);
    return NextResponse.json({
      draft,
      content: {
        titleKo: content.titleKo,
        keywords: content.keywords,
        detailHtml: content.detailHtml,
        options: content.options,
        noticeText: content.noticeText,
        translationNote: content.translationNote,
        sourceLang: content.sourceLang,
        usedGpt: content.usedGpt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 상세 재생성 실패";
    const status = message.includes("찾을 수 없") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
