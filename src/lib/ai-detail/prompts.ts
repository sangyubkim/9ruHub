import { escapeHtml } from "@/lib/ai-detail/html";
import { localizeOptions, type LocalizedOption } from "@/lib/ai-detail/options";
import type { AiDetailContent, AiDetailInput } from "@/lib/ai-detail/types";
import { DEFAULT_NOTICE } from "@/lib/draft/detail-template";

export const AI_DETAIL_SYSTEM_PROMPT = `당신은 한국 스마트스토어/쿠팡용 해외구매대행 상세페이지 전문 카피라이터입니다.

규칙:
1. 제공된 JSON 사실만 사용하세요. 없는 스펙·인증·의료/치료 효과를 만들지 마세요.
2. 과장 광고·허위 클레임 금지. "치료", "완치", "FDA 승인(근거 없음)" 등 금지.
3. 출력은 JSON 객체만: {
  "titleKo": "한국어 상품명(구매대행 톤, 100자 이내)",
  "keywords": ["검색키워드", "..."],
  "detailHtml": "HTML fragment(section/h2/h3/p/ul/li/a/img만)",
  "options": [{"name":"한국어옵션명","values":["값"],"nameEn":"원문옵션명"}],
  "noticeText": "구매대행 고지(줄바꿈 가능)",
  "translationNote": "원문 언어→한국어 번역 메모 1~2문장",
  "sourceLang": "en"
}
4. detailHtml에는 반드시 포함: 구매대행 고지, 혜택/포인트 bullet, 기본정보/스펙, FAQ성 Q&A 2~3개, 원본 링크(있으면).
5. 숫자는 입력 JSON의 가격/재고만 사용하세요.`;

export function buildAiDetailUserPayload(input: AiDetailInput) {
  return {
    task: "ai_detail_page",
    locale: "ko-KR",
    channel: ["SMARTSTORE", "COUPANG"],
    sourceLang: input.sourceLang ?? "en",
    product: {
      title: input.title,
      brand: input.brand ?? null,
      sourceUrl: input.sourceUrl ?? null,
      asin: input.asin ?? null,
      sourcePriceUsd: input.sourcePriceUsd ?? null,
      salePriceKrw: input.salePriceKrw ?? null,
      inStock: input.inStock ?? true,
      images: (input.images ?? []).slice(0, 8),
      options: input.options ?? [],
      bullets: input.bullets ?? [],
      categoryHint: input.categoryHint ?? "해외구매대행",
    },
    constraints: {
      maxTitleLength: 100,
      noMedicalClaims: true,
      requireAgencyNotice: true,
    },
  };
}

function buildKeywords(input: AiDetailInput): string[] {
  const words = new Set<string>();
  words.add("해외구매대행");
  words.add("직구");
  if (input.brand) words.add(input.brand.trim());
  if (input.categoryHint) words.add(input.categoryHint.trim());
  const titleTokens = input.title
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 24);
  for (const t of titleTokens.slice(0, 8)) words.add(t);
  words.add("스마트스토어");
  return [...words].slice(0, 12);
}

function buildTitleKo(input: AiDetailInput): string {
  const brand = input.brand ? `${input.brand} ` : "";
  const cleaned = input.title.replace(/\s+/g, " ").trim();
  return `[구매대행] ${brand}${cleaned}`.trim().slice(0, 100);
}

export function templateAiDetail(input: AiDetailInput): AiDetailContent {
  const titleKo = buildTitleKo(input);
  const keywords = buildKeywords(input);
  const options = localizeOptions(input.options ?? []);
  const sourceLang = input.sourceLang ?? "en";
  const priceLine =
    input.salePriceKrw != null
      ? `예상 판매가 ${input.salePriceKrw.toLocaleString("ko-KR")}원`
      : "판매가는 검수 후 확정됩니다";
  const usdLine =
    input.sourcePriceUsd != null
      ? `원가 참고 $${input.sourcePriceUsd}`
      : "원가 정보는 원본몰 기준으로 확인하세요";

  const imageHtml = (input.images ?? [])
    .slice(0, 5)
    .map(
      (src) =>
        `<p style="text-align:center"><img src="${escapeHtml(src)}" alt="${escapeHtml(titleKo)}" style="max-width:100%"/></p>`,
    )
    .join("\n");

  const optionHtml =
    options.length > 0
      ? options
          .map(
            (o) =>
              `<li><strong>${escapeHtml(o.name)}</strong>: ${escapeHtml(o.values.join(", "))}</li>`,
          )
          .join("\n")
      : "<li>단일 구성</li>";

  const bulletFacts = [
    "해외몰 정품 구매대행으로 진행됩니다.",
    priceLine,
    input.inStock === false
      ? "원본몰 품절 가능성이 있어 입고 후 안내드릴 수 있습니다."
      : "주문 시점 원본몰 재고를 기준으로 구매를 진행합니다.",
    "국제배송·통관으로 국내 일반배송보다 기간이 소요될 수 있습니다.",
  ];

  const detailHtml = `
<section>
  <h2>${escapeHtml(titleKo)}</h2>
  <p>브랜드/상품 정보를 바탕으로 정리한 구매대행 상세입니다. 실제 구성·색상은 원본 상품 페이지를 따릅니다.</p>
  ${
    input.sourceUrl
      ? `<p>원본 링크: <a href="${escapeHtml(input.sourceUrl)}" target="_blank" rel="noreferrer">상품 확인</a>${
          input.asin ? ` (ASIN: ${escapeHtml(input.asin)})` : ""
        }</p>`
      : ""
  }
  ${imageHtml}
  <h3>이런 분들께 추천</h3>
  <ul>
    ${bulletFacts.map((b) => `<li>${escapeHtml(b)}</li>`).join("\n")}
  </ul>
  <h3>기본 정보</h3>
  <ul>
    <li>브랜드: ${escapeHtml(input.brand ?? "확인 필요")}</li>
    <li>${escapeHtml(usdLine)}</li>
    <li>${escapeHtml(priceLine)}</li>
    <li>카테고리 힌트: ${escapeHtml(input.categoryHint ?? "해외구매대행")}</li>
  </ul>
  <h3>옵션</h3>
  <ul>
    ${optionHtml}
  </ul>
  <h3>FAQ</h3>
  <ul>
    <li><strong>Q. 배송은 얼마나 걸리나요?</strong><br/>A. 해외 구매 → 국제배송 → 통관 순으로 진행되어 통상 국내배송보다 오래 걸립니다.</li>
    <li><strong>Q. 관부가세가 발생하나요?</strong><br/>A. 상품가·환율·품목에 따라 달라질 수 있으며, 발생 시 별도 안내드릴 수 있습니다.</li>
    <li><strong>Q. 교환/반품은 어떻게 되나요?</strong><br/>A. 해외구매대행 특성상 단순 변심 반품이 제한될 수 있으며, 불량·오배송은 원본몰 정책과 함께 검토합니다.</li>
  </ul>
  <h3>구매대행 안내</h3>
  <ul>
    ${DEFAULT_NOTICE.split("\n")
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("\n")}
  </ul>
</section>
`.trim();

  return {
    titleKo,
    keywords,
    detailHtml,
    options,
    noticeText: DEFAULT_NOTICE,
    translationNote: `${sourceLang} 원문 제목·옵션을 한국어 구매대행 리스팅용으로 정리했습니다. 의료·효능 표현은 포함하지 않았습니다.`,
    sourceLang,
    usedGpt: false,
  };
}

export function optionsToJson(options: LocalizedOption[]) {
  return options.map((o) => ({
    name: o.name,
    values: o.values,
    ...(o.nameEn ? { nameEn: o.nameEn } : {}),
  }));
}
