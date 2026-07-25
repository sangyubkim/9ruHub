import type { FetchedProduct } from "@/lib/amazon/fetch-product";
import type { CostBreakdown } from "@/lib/price-engine";

export const DEFAULT_NOTICE = [
  "본 상품은 해외 구매대행 상품입니다.",
  "주문 후 해외몰 구매 → 국제배송 → 통관 절차로 진행되며, 일반 국내배송보다 기간이 더 소요될 수 있습니다.",
  "환율/관부가세/현지 재고 상황에 따라 추가 안내가 있을 수 있습니다.",
  "상품 이미지는 판매 시점 원본몰 기준이며, 실제 구성은 원본 상품 페이지를 따릅니다.",
].join("\n");

export function localizeTitle(title: string, brand?: string | null): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  const prefix = brand ? `${brand} ` : "";
  const base = `${prefix}${cleaned}`.trim();
  const withTag = `[구매대행] ${base}`;
  return withTag.slice(0, 100);
}

export function renderDetailHtml(
  product: FetchedProduct,
  breakdown: CostBreakdown,
  noticeText: string,
): string {
  const imageTags = product.images
    .map((src) => `<p style="text-align:center"><img src="${src}" alt="${escapeHtml(product.title)}" style="max-width:100%"/></p>`)
    .join("\n");

  const optionRows = product.options
    .map(
      (o) =>
        `<li><strong>${escapeHtml(o.name)}</strong>: ${escapeHtml(o.values.join(", "))}</li>`,
    )
    .join("\n");

  const noticeHtml = noticeText
    .split("\n")
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("\n");

  return `
<section>
  <h2>${escapeHtml(localizeTitle(product.title, product.brand))}</h2>
  <p>원본: <a href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(product.sourceUrl)}</a></p>
  <p>ASIN: ${escapeHtml(product.asin)}</p>
  ${imageTags}
  <h3>옵션</h3>
  <ul>${optionRows}</ul>
  <h3>가격 참고</h3>
  <ul>
    <li>원가: $${breakdown.sourcePriceUsd} (약 ${breakdown.sourcePriceKrw.toLocaleString("ko-KR")}원)</li>
    <li>예상 판매가: ${breakdown.salePriceKrw.toLocaleString("ko-KR")}원</li>
  </ul>
  <h3>구매대행 안내</h3>
  <ul>${noticeHtml}</ul>
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
