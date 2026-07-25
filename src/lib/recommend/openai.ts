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

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return { apiKey, model };
}

async function chatJson(
  system: string,
  userPayload: unknown,
): Promise<Record<string, unknown> | null> {
  const { apiKey, model } = getOpenAiConfig();
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!res.ok) {
    console.warn("OpenAI chat failed", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * GPT는 추천 이유/상세 HTML만 생성. 점수·숫자는 코드 입력을 그대로 사용.
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

  const { apiKey } = getOpenAiConfig();
  if (!apiKey) return fallback;

  try {
    const [reasonJson, detailJson] = await Promise.all([
      chatJson(REASON_SYSTEM_PROMPT, buildReasonUserPayload(input)),
      chatJson(DETAIL_SYSTEM_PROMPT, buildDetailUserPayload(input)),
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
