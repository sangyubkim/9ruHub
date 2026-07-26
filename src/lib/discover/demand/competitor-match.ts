export type CompetitorMatchKind = "same_likely" | "similar";

const STOP = new Set([
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
  "by",
  "usb",
  "c",
  "wireless",
  "earbuds",
  "headphones",
  "noise",
  "cancelling",
  "cancellation",
  "bluetooth",
  "charging",
  "case",
  "pro",
  "max",
  "mini",
  "true",
  "active",
]);

/** 모델번호·브랜드성 토큰 (숫자 포함 또는 길이≥4) */
export function distinctiveTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/\[구매대행\]/g, " ")
    .replace(/\[초안\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\w가-힣+.-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);

  const out: string[] = [];
  for (const t of raw) {
    if (STOP.has(t)) continue;
    if (t.length < 2) continue;
    const hasDigit = /\d/.test(t);
    if (hasDigit && t.length >= 2) {
      out.push(t);
      continue;
    }
    if (t.length >= 4) out.push(t);
  }
  return [...new Set(out)].slice(0, 12);
}

/**
 * 소스(Amazon) 제목·브랜드 vs 네이버 제목 → 동일 추정 / 유사.
 * ASIN 1:1 매칭이 아니므로 same_likely = 모델·브랜드 토큰 겹침 추정.
 */
export function classifyCompetitorMatch(options: {
  sourceTitle: string;
  sourceBrand?: string | null;
  competitorTitle: string;
}): { kind: CompetitorMatchKind; label: string } {
  const sourceTokens = distinctiveTokens(
    `${options.sourceBrand ?? ""} ${options.sourceTitle}`,
  );
  const compNorm = options.competitorTitle.toLowerCase();

  const modelTokens = sourceTokens.filter((t) => /\d/.test(t));
  const brandTokens = distinctiveTokens(options.sourceBrand ?? "").filter(
    (t) => t.length >= 3,
  );

  const hitModel = modelTokens.filter((t) => compNorm.includes(t));
  const hitBrand = brandTokens.filter((t) => compNorm.includes(t));
  const hitAny = sourceTokens.filter((t) => compNorm.includes(t));

  // 모델번호(숫자 포함) + 브랜드가 같이 맞으면 동일 추정
  if (hitModel.length >= 1 && (hitBrand.length >= 1 || brandTokens.length === 0)) {
    return { kind: "same_likely", label: "동일 추정" };
  }
  // 모델번호만 강하게 맞음 (P40i 등)
  if (hitModel.length >= 1 && hitModel.some((t) => t.length >= 3)) {
    return { kind: "same_likely", label: "동일 추정" };
  }
  // 특징 토큰 2개 이상
  if (hitAny.length >= 2) {
    return { kind: "same_likely", label: "동일 추정" };
  }

  return { kind: "similar", label: "유사" };
}

export function matchKindLabel(kind: CompetitorMatchKind): string {
  return kind === "same_likely" ? "동일 추정" : "유사";
}
