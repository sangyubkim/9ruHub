import { createHmac } from "node:crypto";

/**
 * 네이버 검색광고 키워드도구 API.
 * @see https://api.searchad.naver.com
 */

export type NaverKeywordHint = {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  monthlyAvePcClkCnt?: number;
  monthlyAveMobileClkCnt?: number;
  monthlyAvePcCtr?: number;
  monthlyAveMobileCtr?: number;
  plAvgDepth?: number;
  compIdx?: string;
};

export function hasNaverSearchAdCredentials(): boolean {
  return Boolean(
    process.env.NAVER_SEARCHAD_ACCESS_KEY?.trim() &&
      process.env.NAVER_SEARCHAD_SECRET_KEY?.trim() &&
      process.env.NAVER_SEARCHAD_CUSTOMER_ID?.trim(),
  );
}

/** "< 10" 등 문자열 QC 카운트를 숫자로 */
export function parseQcCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith("<")) {
    const n = Number(trimmed.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? Math.max(1, Math.floor(n / 2)) : 5;
  }
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function buildSearchAdSignature(
  timestamp: string | number,
  method: string,
  uri: string,
  secretKey: string,
): string {
  const message = `${timestamp}.${method.toUpperCase()}.${uri}`;
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export async function fetchNaverKeywordHints(
  keyword: string,
): Promise<NaverKeywordHint[]> {
  const apiKey = process.env.NAVER_SEARCHAD_ACCESS_KEY?.trim();
  const secretKey = process.env.NAVER_SEARCHAD_SECRET_KEY?.trim();
  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID?.trim();
  if (!apiKey || !secretKey || !customerId) {
    throw new Error(
      "NAVER_SEARCHAD_ACCESS_KEY / SECRET_KEY / CUSTOMER_ID 가 필요합니다.",
    );
  }

  const uri = "/keywordstool";
  const method = "GET";
  const timestamp = Date.now().toString();
  const signature = buildSearchAdSignature(timestamp, method, uri, secretKey);

  const query = new URLSearchParams({
    hintKeywords: keyword.trim(),
    showDetail: "1",
  });

  const res = await fetch(`https://api.searchad.naver.com${uri}?${query}`, {
    method,
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": apiKey,
      "X-Customer": customerId,
      "X-Signature": signature,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Naver SearchAd API ${res.status}: ${body.slice(0, 200) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    keywordList?: Array<Record<string, unknown>>;
  };

  const list = Array.isArray(data.keywordList) ? data.keywordList : [];
  return list.map((row) => ({
    relKeyword: String(row.relKeyword ?? ""),
    monthlyPcQcCnt: parseQcCount(row.monthlyPcQcCnt),
    monthlyMobileQcCnt: parseQcCount(row.monthlyMobileQcCnt),
    monthlyAvePcClkCnt:
      typeof row.monthlyAvePcClkCnt === "number"
        ? row.monthlyAvePcClkCnt
        : undefined,
    monthlyAveMobileClkCnt:
      typeof row.monthlyAveMobileClkCnt === "number"
        ? row.monthlyAveMobileClkCnt
        : undefined,
    monthlyAvePcCtr:
      typeof row.monthlyAvePcCtr === "number" ? row.monthlyAvePcCtr : undefined,
    monthlyAveMobileCtr:
      typeof row.monthlyAveMobileCtr === "number"
        ? row.monthlyAveMobileCtr
        : undefined,
    plAvgDepth: typeof row.plAvgDepth === "number" ? row.plAvgDepth : undefined,
    compIdx: typeof row.compIdx === "string" ? row.compIdx : undefined,
  }));
}

/** hint 목록에서 원 키워드와 가장 가까운 행의 월간 검색량(PC+모바일) */
export function pickSearchVolume(
  keyword: string,
  hints: NaverKeywordHint[],
): { searchVolume: number; matchedKeyword: string | null } {
  if (hints.length === 0) {
    return { searchVolume: 0, matchedKeyword: null };
  }

  const normalized = keyword.trim().toLowerCase().replace(/\s+/g, "");
  const exact =
    hints.find(
      (h) => h.relKeyword.trim().toLowerCase().replace(/\s+/g, "") === normalized,
    ) ?? hints[0];

  const searchVolume = exact.monthlyPcQcCnt + exact.monthlyMobileQcCnt;
  return { searchVolume, matchedKeyword: exact.relKeyword || null };
}

/** 검색광고 경쟁지수 문자열 → 0–1 (없을 때 null) */
export function competitionFromCompIdx(compIdx: string | undefined): number | null {
  if (!compIdx) return null;
  const key = compIdx.trim().toLowerCase();
  if (key.includes("높") || key === "high") return 0.8;
  if (key.includes("중") || key === "mid" || key === "medium") return 0.5;
  if (key.includes("낮") || key === "low") return 0.25;
  return null;
}
