import type { ScoreBreakdown } from "@/lib/recommend/score";

export type RecommendGptInput = {
  title: string;
  brand?: string | null;
  sourceUrl?: string | null;
  sourcePriceUsd: number;
  salePriceKrw: number;
  costKrw: number;
  inStock: boolean;
  score: number;
  scoreBreakdown: ScoreBreakdown;
};

export const REASON_SYSTEM_PROMPT = `당신은 한국 해외구매대행 셀러를 돕는 카피라이터입니다.
숫자는 절대 새로 만들지 말고, 제공된 JSON의 score/가격만 사용하세요.
한국어로 2~3문장 추천 이유를 작성하세요. JSON만 반환: {"reasonText":"..."}`;

export const DETAIL_SYSTEM_PROMPT = `당신은 구매대행 상세페이지 작성기입니다.
제공된 JSON 사실만 사용하고 허위 스펙을 만들지 마세요.
한국어 HTML fragment(section/h2/p/ul)만 반환: {"detailHtml":"..."}`;

export function buildReasonUserPayload(input: RecommendGptInput) {
  return {
    task: "recommend_reason",
    product: {
      title: input.title,
      brand: input.brand ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sourcePriceUsd: input.sourcePriceUsd,
      salePriceKrw: input.salePriceKrw,
      costKrw: input.costKrw,
      inStock: input.inStock,
    },
    scoring: {
      total: input.score,
      reasons: input.scoreBreakdown.reasons,
      marginScore: input.scoreBreakdown.marginScore,
      priceBandScore: input.scoreBreakdown.priceBandScore,
    },
  };
}

export function buildDetailUserPayload(input: RecommendGptInput) {
  return {
    task: "detail_html",
    product: {
      title: input.title,
      brand: input.brand ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sourcePriceUsd: input.sourcePriceUsd,
      salePriceKrw: input.salePriceKrw,
      inStock: input.inStock,
    },
    notice: "해외구매대행 상품이며 통관/배송 기간이 소요될 수 있습니다.",
  };
}

export function templateReasonText(input: RecommendGptInput): string {
  const margin = input.salePriceKrw - input.costKrw;
  return [
    `규칙 점수 ${input.score.toFixed(1)}점(${input.scoreBreakdown.reasons.slice(0, 3).join(", ")})으로 추천합니다.`,
    `예상 판매가 ${input.salePriceKrw.toLocaleString("ko-KR")}원, 원가성 비용 약 ${input.costKrw.toLocaleString("ko-KR")}원(추정 이익 ${margin.toLocaleString("ko-KR")}원).`,
    input.inStock ? "현재 원본몰 재고가 확인됩니다." : "품절 상태라 입고 후 재검토가 필요합니다.",
  ].join(" ");
}

export function templateDetailHtml(input: RecommendGptInput): string {
  const title = input.brand ? `${input.brand} ${input.title}` : input.title;
  return `
<section>
  <h2>[구매대행] ${escapeHtml(title)}</h2>
  <p>원본 링크: ${input.sourceUrl ? `<a href="${escapeHtml(input.sourceUrl)}" target="_blank" rel="noreferrer">상품 보기</a>` : "없음"}</p>
  <ul>
    <li>원가(USD): $${input.sourcePriceUsd}</li>
    <li>예상 판매가: ${input.salePriceKrw.toLocaleString("ko-KR")}원</li>
    <li>재고: ${input.inStock ? "있음" : "없음"}</li>
  </ul>
  <p>본 상품은 해외 구매대행 상품이며, 국제배송·통관 절차로 일반 국내배송보다 기간이 소요될 수 있습니다.</p>
</section>
`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
