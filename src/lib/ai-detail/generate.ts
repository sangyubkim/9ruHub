import { geminiChatJson, getGeminiConfig } from "@/lib/ai/gemini";
import { parseAiDetailResponse } from "@/lib/ai-detail/parse";
import {
  AI_DETAIL_SYSTEM_PROMPT,
  buildAiDetailUserPayload,
  templateAiDetail,
} from "@/lib/ai-detail/prompts";
import type { AiDetailContent, AiDetailInput } from "@/lib/ai-detail/types";

/**
 * Gemini로 상세페이지 콘텐츠 생성. 키 없거나 실패 시 고품질 한국어 템플릿 폴백.
 * 점수는 생성하지 않음 — 콘텐츠만.
 */
export async function generateAiDetail(
  input: AiDetailInput,
): Promise<AiDetailContent> {
  const fallback = templateAiDetail(input);
  const { enabled } = getGeminiConfig();
  if (!enabled) return fallback;

  try {
    const json = await geminiChatJson(
      AI_DETAIL_SYSTEM_PROMPT,
      buildAiDetailUserPayload(input),
      0.45,
    );
    if (!json) return fallback;
    return parseAiDetailResponse(json, input, true);
  } catch (error) {
    console.warn("generateAiDetail fallback", error);
    return fallback;
  }
}
