/**
 * 자동 발굴용 카테고리 시드 키워드.
 * 1단계: 이 목록을 일괄 스캔
 * 2단계: 검색광고 연관키워드로 확장 (expandRelatedKeywords)
 */

export type DiscoverSeedCategory =
  | "seasonal_home"
  | "camping"
  | "car"
  | "kitchen"
  | "pet"
  | "beauty"
  | "office";

export type DiscoverSeedKeyword = {
  category: DiscoverSeedCategory;
  keyword: string;
};

export const DISCOVER_SEED_CATEGORY_LABELS: Record<
  DiscoverSeedCategory,
  string
> = {
  seasonal_home: "계절가전/생활",
  camping: "캠핑/아웃도어",
  car: "차량용품",
  kitchen: "주방/수납",
  pet: "반려동물",
  beauty: "뷰티/헬스",
  office: "사무/디지털",
};

/** MVP 샘플 시드 — 카테고리별 대표 검색어 */
export const DISCOVER_SEED_KEYWORDS: DiscoverSeedKeyword[] = [
  // 계절가전/생활
  { category: "seasonal_home", keyword: "무선선풍기" },
  { category: "seasonal_home", keyword: "미니선풍기" },
  { category: "seasonal_home", keyword: "휴대용선풍기" },
  { category: "seasonal_home", keyword: "제습기" },
  { category: "seasonal_home", keyword: "가습기" },
  { category: "seasonal_home", keyword: "공기청정기필터" },
  { category: "seasonal_home", keyword: "전기모기채" },
  { category: "seasonal_home", keyword: "수납정리함" },
  // 캠핑
  { category: "camping", keyword: "캠핑의자" },
  { category: "camping", keyword: "접이식테이블" },
  { category: "camping", keyword: "캠핑랜턴" },
  { category: "camping", keyword: "쿨러백" },
  { category: "camping", keyword: "캠핑식기" },
  { category: "camping", keyword: "타프" },
  // 차량
  { category: "car", keyword: "차량용핸드폰거치대" },
  { category: "car", keyword: "차량용청소기" },
  { category: "car", keyword: "차량용쓰레기통" },
  { category: "car", keyword: "차량용방향제" },
  { category: "car", keyword: "차량용선풍기" },
  // 주방
  { category: "kitchen", keyword: "전자저울" },
  { category: "kitchen", keyword: "실리콘도마" },
  { category: "kitchen", keyword: "밀폐용기" },
  { category: "kitchen", keyword: "주방수납선반" },
  { category: "kitchen", keyword: "마늘다지기" },
  // 펫
  { category: "pet", keyword: "강아지장난감" },
  { category: "pet", keyword: "고양이스크래쳐" },
  { category: "pet", keyword: "반려동물급식기" },
  { category: "pet", keyword: "강아지배변패드" },
  // 뷰티
  { category: "beauty", keyword: "요가매트" },
  { category: "beauty", keyword: "폼롤러" },
  { category: "beauty", keyword: "마사지건" },
  { category: "beauty", keyword: "헤어드라이기거치대" },
  // 사무
  { category: "office", keyword: "노트북거치대" },
  { category: "office", keyword: "모니터암" },
  { category: "office", keyword: "케이블정리" },
  { category: "office", keyword: "무선충전기" },
  { category: "office", keyword: "블루투스이어폰케이스" },
];

export function listSeedCategories(): DiscoverSeedCategory[] {
  return Object.keys(DISCOVER_SEED_CATEGORY_LABELS) as DiscoverSeedCategory[];
}

export function getSeedKeywords(options?: {
  category?: DiscoverSeedCategory | "all";
  limit?: number;
}): DiscoverSeedKeyword[] {
  const category = options?.category ?? "all";
  let rows =
    category === "all"
      ? DISCOVER_SEED_KEYWORDS
      : DISCOVER_SEED_KEYWORDS.filter((r) => r.category === category);

  // 중복 키워드 제거 (앞쪽 우선)
  const seen = new Set<string>();
  rows = rows.filter((r) => {
    const key = r.keyword.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const limit = options?.limit;
  if (limit != null && limit > 0) {
    return rows.slice(0, limit);
  }
  return rows;
}

export function uniqKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const k = raw.trim();
    if (!k) continue;
    const key = k.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}
