import { parseAiDetailResponse } from "@/lib/ai-detail/parse";
import {
  AI_DETAIL_SYSTEM_PROMPT,
  buildAiDetailUserPayload,
  templateAiDetail,
} from "@/lib/ai-detail/prompts";
import type { AiDetailContent, AiDetailInput } from "@/lib/ai-detail/types";

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
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    console.warn("OpenAI AI-detail failed", res.status, await res.text());
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
 * GPT로 상세페이지 콘텐츠 생성. 키 없거나 실패 시 고품질 한국어 템플릿 폴백.
 * 점수는 생성하지 않음 — 콘텐츠만.
 */
export async function generateAiDetail(
  input: AiDetailInput,
): Promise<AiDetailContent> {
  const fallback = templateAiDetail(input);
  const { apiKey } = getOpenAiConfig();
  if (!apiKey) return fallback;

  try {
    const json = await chatJson(
      AI_DETAIL_SYSTEM_PROMPT,
      buildAiDetailUserPayload(input),
    );
    if (!json) return fallback;
    return parseAiDetailResponse(json, input, true);
  } catch (error) {
    console.warn("generateAiDetail fallback", error);
    return fallback;
  }
}
