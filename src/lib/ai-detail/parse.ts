import { sanitizeDetailHtml } from "@/lib/ai-detail/html";
import {
  localizeOptionName,
  localizeOptionValue,
  type LocalizedOption,
} from "@/lib/ai-detail/options";
import type { AiDetailContent, AiDetailInput } from "@/lib/ai-detail/types";
import { templateAiDetail } from "@/lib/ai-detail/prompts";
import { DEFAULT_NOTICE } from "@/lib/draft/detail-template";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseOptions(value: unknown): LocalizedOption[] {
  if (!Array.isArray(value)) return [];
  const parsed: LocalizedOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const nameRaw = asString(row.name);
    if (!nameRaw) continue;
    const values = asStringArray(row.values).map(localizeOptionValue);
    if (!values.length) continue;
    parsed.push({
      name: localizeOptionName(nameRaw),
      values,
      nameEn: asString(row.nameEn) ?? undefined,
    });
  }
  return parsed;
}

/**
 * GPT JSON → AiDetailContent. 필수 필드 누락 시 템플릿으로 채움.
 */
export function parseAiDetailResponse(
  raw: Record<string, unknown> | null | undefined,
  input: AiDetailInput,
  usedGpt: boolean,
): AiDetailContent {
  const fallback = templateAiDetail(input);
  if (!raw) return { ...fallback, usedGpt: false };

  const titleKo = asString(raw.titleKo)?.slice(0, 100) ?? fallback.titleKo;
  const keywords = asStringArray(raw.keywords);
  const detailHtmlRaw = asString(raw.detailHtml);
  const detailHtml = detailHtmlRaw
    ? sanitizeDetailHtml(detailHtmlRaw)
    : fallback.detailHtml;
  const options = parseOptions(raw.options);
  const noticeText = asString(raw.noticeText) ?? DEFAULT_NOTICE;
  const translationNote =
    asString(raw.translationNote) ?? fallback.translationNote;
  const sourceLang = asString(raw.sourceLang) ?? fallback.sourceLang;

  return {
    titleKo,
    keywords: keywords.length ? keywords.slice(0, 16) : fallback.keywords,
    detailHtml: detailHtml || fallback.detailHtml,
    options: options.length ? options : fallback.options,
    noticeText,
    translationNote,
    sourceLang,
    usedGpt,
  };
}
