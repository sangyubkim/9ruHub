import type { DiscoverScoreBreakdown } from "@/lib/discover/score";
import type { JoinedCandidateMetrics } from "@/lib/discover/types";

type ChatResult = { reasonText: string; detailHtml: string; usedGpt: boolean };

const REASON_SYSTEM = `당신은 한국 구매대행 셀러를 돕는 카피라이터입니다.
숫자는 절대 새로 만들지 말고, 제공된 JSON의 score/마진/검색량만 사용하세요.
한국어로 2~3문장 추천 이유를 작성하세요. JSON만 반환: {"reasonText":"..."}`;

const DETAIL_SYSTEM = `당신은 구매대행 상품 발굴 상세 작성기입니다.
제공된 JSON 사실만 사용하세요. 한국어 HTML fragment만 반환: {"detailHtml":"..."}`;

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
    console.warn("OpenAI discover chat failed", res.status, await res.text());
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

export function templateDiscoverReason(
  metrics: JoinedCandidateMetrics,
  breakdown: DiscoverScoreBreakdown,
): string {
  return [
    `규칙 점수 ${breakdown.total.toFixed(1)}점(${breakdown.label}, ${breakdown.reasons.slice(0, 3).join(", ")})으로 발굴 추천합니다.`,
    `네이버 검색량 약 ${metrics.searchVolume.toLocaleString("ko-KR")}, 경쟁 ${metrics.competition.toFixed(2)}, 예상 마진 ${(metrics.marginRate * 100).toFixed(1)}%.`,
    `1688 원가 약 ¥${metrics.costPriceCny}, 추정 판매가 ${metrics.sellPriceKrw.toLocaleString("ko-KR")}원${metrics.isStub ? " (스텁 메트릭)" : ""}.`,
  ].join(" ");
}

export function templateDiscoverDetailHtml(
  metrics: JoinedCandidateMetrics,
  breakdown: DiscoverScoreBreakdown,
): string {
  return `
<section>
  <h2>[발굴] ${escapeHtml(metrics.title)}</h2>
  <p>키워드: ${escapeHtml(metrics.keyword)} · ${breakdown.label} ${breakdown.total.toFixed(1)}점</p>
  <ul>
    <li>수요(네이버): 검색량 ${metrics.searchVolume}, 경쟁 ${metrics.competition}, 평점 ${metrics.rating}, 리뷰 ${metrics.reviewCount}</li>
    <li>공급(1688): 원가 ¥${metrics.costPriceCny}, 판매가 추정 ${metrics.sellPriceKrw.toLocaleString("ko-KR")}원, 마진 ${(metrics.marginRate * 100).toFixed(1)}%</li>
    <li>시즌성: ${metrics.seasonalityScore}</li>
  </ul>
  <p>${metrics.isStub ? "데모/스텁 메트릭입니다. 라이브 크롤 연동 전 참고용입니다." : "수집 메트릭 기반입니다."}</p>
</section>
`.trim();
}

/**
 * GPT는 추천 이유/상세만 생성. 점수·숫자는 코드 입력을 그대로 사용.
 */
export async function generateDiscoverRecommendCopy(
  metrics: JoinedCandidateMetrics,
  breakdown: DiscoverScoreBreakdown,
): Promise<ChatResult> {
  const fallback = {
    reasonText: templateDiscoverReason(metrics, breakdown),
    detailHtml: templateDiscoverDetailHtml(metrics, breakdown),
    usedGpt: false,
  };

  const { apiKey } = getOpenAiConfig();
  if (!apiKey) return fallback;

  const payload = {
    task: "discover_recommend_reason",
    candidate: {
      keyword: metrics.keyword,
      title: metrics.title,
      demandMall: metrics.sourceDemandMall,
      supplyMall: metrics.sourceSupplyMall,
      searchVolume: metrics.searchVolume,
      competition: metrics.competition,
      rating: metrics.rating,
      reviewCount: metrics.reviewCount,
      costPriceCny: metrics.costPriceCny,
      sellPriceKrw: metrics.sellPriceKrw,
      marginRate: metrics.marginRate,
      seasonalityScore: metrics.seasonalityScore,
      isStub: metrics.isStub,
    },
    scoring: {
      total: breakdown.total,
      label: breakdown.label,
      reasons: breakdown.reasons,
    },
  };

  try {
    const [reasonJson, detailJson] = await Promise.all([
      chatJson(REASON_SYSTEM, payload),
      chatJson(DETAIL_SYSTEM, payload),
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
    console.warn("generateDiscoverRecommendCopy fallback", error);
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
