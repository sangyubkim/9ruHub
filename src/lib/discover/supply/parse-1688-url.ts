/**
 * 1688 상품 URL에서 offer id 추출.
 */

const OFFER_PATH_RE =
  /(?:detail|m)\.1688\.com\/offer\/(\d+)\.html/i;
const OFFER_QUERY_RE = /[?&](?:offerId|offer_id)=(\d+)/i;
const BARE_OFFER_RE = /^\d{6,20}$/;

export function extract1688OfferId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (BARE_OFFER_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const pathMatch = url.href.match(OFFER_PATH_RE);
    if (pathMatch?.[1]) return pathMatch[1];
    const q =
      url.searchParams.get("offerId") ??
      url.searchParams.get("offer_id") ??
      null;
    if (q && BARE_OFFER_RE.test(q)) return q;
  } catch {
    // fall through
  }

  const pathMatch = trimmed.match(OFFER_PATH_RE);
  if (pathMatch?.[1]) return pathMatch[1];
  const queryMatch = trimmed.match(OFFER_QUERY_RE);
  if (queryMatch?.[1]) return queryMatch[1];
  return null;
}

export function is1688OfferUrl(input: string): boolean {
  return extract1688OfferId(input) != null;
}

export function to1688OfferUrl(offerId: string): string {
  return `https://detail.1688.com/offer/${offerId}.html`;
}

/** 스텁이 만들던 가짜 detail URL (offer/1688-xxx) — 실상품이 아니라 404 */
export function isFake1688StubDetailUrl(input: string | null | undefined): boolean {
  if (!input) return false;
  return /detail\.1688\.com\/offer\/(?:1688-|stub-)/i.test(input);
}
