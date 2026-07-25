import { geminiChatJson, getGeminiConfig } from "@/lib/ai/gemini";
import {
  DETAIL_SYSTEM_PROMPT,
  REASON_SYSTEM_PROMPT,
  buildDetailUserPayload,
  buildReasonUserPayload,
  templateDetailHtml,
  templateReasonText,
  type RecommendGptInput,
} from "@/lib/recommend/prompts";

type ChatResult = { reasonText: string; detailHtml: string; usedGpt: boolean };

/**
 * Gemini는 추천 이유/상세 HTML만 생성. 점수·숫자는 코드 입력을 그대로 사용.
 * API 키 없거나 실패 시 템플릿 폴백.
 */
export async function generateRecommendCopy(
  input: RecommendGptInput,
): Promise<ChatResult> {
  const fallback = {
    reasonText: templateReasonText(input),
    detailHtml: templateDetailHtml(input),
    usedGpt: false,
  };

  if (!getGeminiConfig().enabled) return fallback;

  try {
    const [reasonJson, detailJson] = await Promise.all([
      geminiChatJson(REASON_SYSTEM_PROMPT, buildReasonUserPayload(input)),
      geminiChatJson(DETAIL_SYSTEM_PROMPT, buildDetailUserPayload(input)),
    ]);

    const reasonText =
      typeof reasonJson?.reasonText === "string" && reasonJson.reasonText.trim()
        ? reasonJson.reasonText.trim()
        : fallback.reasonText;
    const detailHtml =
      typeof detailJson?.detailHtml === "string" && detailJson.detailHtml.trim()
        ? detailJson.detailHtml.trim()
        : fallback.detailHtml;

    return {
      reasonText,
      detailHtml,
      usedGpt: Boolean(reasonJson || detailJson),
    };
  } catch (error) {
    console.warn("generateRecommendCopy fallback", error);
    return fallback;
  }
}
