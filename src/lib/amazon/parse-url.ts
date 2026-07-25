const ASIN_RE = /\b([A-Z0-9]{10})\b/;

/**
 * Amazon US URL / ASIN 문자열에서 ASIN 추출
 */
export function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.includes("amazon.")) {
      return null;
    }

    const dp = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
    if (dp?.[1]) return dp[1].toUpperCase();

    const asinParam = url.searchParams.get("ASIN") ?? url.searchParams.get("asin");
    if (asinParam && /^[A-Z0-9]{10}$/i.test(asinParam)) {
      return asinParam.toUpperCase();
    }

    const fromPath = url.pathname.match(ASIN_RE);
    if (fromPath?.[1]) return fromPath[1].toUpperCase();
  } catch {
    const loose = trimmed.match(ASIN_RE);
    if (loose?.[1]) return loose[1].toUpperCase();
  }

  return null;
}

export function toAmazonUsUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}

export function isAmazonUsUrl(input: string): boolean {
  try {
    const host = new URL(input.trim()).hostname.replace(/^www\./, "");
    return host === "amazon.com" || host.endsWith(".amazon.com");
  } catch {
    return false;
  }
}
