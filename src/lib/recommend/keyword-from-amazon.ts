/**
 * Amazon 영문 제목 → 네이버 쇼핑 검색용 키워드(짧게).
 * 폴백 제목이면 빈 문자열.
 */
export function keywordFromAmazonTitle(
  title: string,
  brand?: string | null,
): string {
  let t = title
    .replace(/\[구매대행\]\s*/gi, "")
    .replace(/\[초안\]\s*/gi, "")
    .trim();

  if (/^Amazon US\s+[A-Z0-9]{10}$/i.test(t)) return "";

  t = t
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\w\s가-힣&+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stop = new Set([
    "with",
    "and",
    "for",
    "the",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "usb",
    "c",
  ]);

  const words = t
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !stop.has(w.toLowerCase()))
    .slice(0, 5);

  let keyword = words.join(" ").slice(0, 48);
  if (!keyword && brand?.trim()) keyword = brand.trim().slice(0, 48);
  return keyword;
}
