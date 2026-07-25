import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createDraftWithAiDetail,
  previewAiDetailFromUrl,
} from "@/lib/ai-detail/service";

const schema = z.object({
  url: z.string().min(3),
  /** true면 ProductDraft로 저장, 기본은 미리보기만 */
  save: z.boolean().optional(),
});

/**
 * POST /api/ai/detail
 * { url } → AI 상세 미리보기
 * { url, save: true } → 초안 저장
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (body.save) {
      const { draft, content } = await createDraftWithAiDetail(body.url);
      return NextResponse.json(
        {
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
        },
        { status: 201 },
      );
    }

    const preview = await previewAiDetailFromUrl(body.url);
    return NextResponse.json({ preview });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 상세 생성 실패";
    const status =
      message.includes("지원") || message.includes("유효") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
