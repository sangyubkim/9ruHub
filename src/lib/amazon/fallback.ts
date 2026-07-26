/** Amazon 파싱 실패 시 쓰는 임시 원가(실가 아님) */
export const AMAZON_FALLBACK_PRICE_USD = 29.99;

export function isAmazonFallbackTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return /\[초안\]\s*Amazon US\s+[A-Z0-9]{10}/i.test(title);
}

export function amazonFallbackTitle(asin: string): string {
  return `[초안] Amazon US ${asin}`;
}
