/**
 * 상품 페이지에서 무게 문자열 → grams 변환 (Amazon / 1688 best-effort).
 */

export type ParsedWeight = {
  weightGrams: number;
  source: string;
  raw: string;
};

/** 단위가 있는 단일 토큰을 grams로 */
export function parseWeightTokenToGrams(
  value: number,
  unitRaw: string,
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = unitRaw.trim().toLowerCase().replace(/\s+/g, "");
  if (
    unit === "g" ||
    unit === "gram" ||
    unit === "grams" ||
    unit === "克" ||
    unit === "公克"
  ) {
    return Math.round(value);
  }
  if (
    unit === "kg" ||
    unit === "kgs" ||
    unit === "kilogram" ||
    unit === "kilograms" ||
    unit === "千克" ||
    unit === "公斤"
  ) {
    return Math.round(value * 1000);
  }
  if (
    unit === "lb" ||
    unit === "lbs" ||
    unit === "pound" ||
    unit === "pounds"
  ) {
    return Math.round(value * 453.59237);
  }
  if (unit === "oz" || unit === "ounce" || unit === "ounces") {
    return Math.round(value * 28.349523125);
  }
  return null;
}

/** "1.2 kg", "500g", "12.3 ounces", "1.5 千克" 등 */
export function parseWeightTextToGrams(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (!t) return null;

  // 복합: 1 pound 2 ounces (반올림은 합산 후 1회)
  const compound = t.match(
    /(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?)\s+(\d+(?:\.\d+)?)\s*(?:ounces?|oz)/i,
  );
  if (compound) {
    const lb = Number(compound[1]);
    const oz = Number(compound[2]);
    const grams = lb * 453.59237 + oz * 28.349523125;
    return grams > 0 ? Math.round(grams) : null;
  }

  const m = t.match(
    /(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|g|grams?|lb|lbs|pounds?|oz|ounces?|千克|公斤|克|公克)/i,
  );
  if (!m) return null;
  return parseWeightTokenToGrams(Number(m[1]), m[2]!);
}

const AMAZON_LABEL_PRIORITY = [
  { re: /shipping\s*weight|package\s*weight/i, source: "amazon_shipping_weight" },
  { re: /item\s*weight|^weight$/i, source: "amazon_item_weight" },
] as const;

/**
 * Cheerio DOM에서 Amazon 상세 표/불릿 무게 추출.
 * Shipping/Package Weight 우선.
 */
export function extractAmazonWeightFromDom(doc: {
  root: (sel: string) => {
    each: (fn: (i: number, el: unknown) => void) => unknown;
  };
  text: (el: unknown) => string;
}): ParsedWeight | null {
  const rows: { label: string; value: string }[] = [];

  doc
    .root(
      "#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #prodDetails tr",
    )
    .each((_, el) => {
      const text = doc.text(el).replace(/\s+/g, " ").trim();
      const m = text.match(
        /^(Shipping Weight|Package Weight|Item Weight|Weight)\s*[:\uFF1A]?\s*(.+)$/i,
      );
      if (m) rows.push({ label: m[1]!, value: m[2]!.trim() });
    });

  doc.root("#detailBullets_feature_div li, .detail-bullet-list li").each((_, el) => {
    const text = doc.text(el).replace(/\s+/g, " ").trim();
    const m = text.match(
      /(Shipping Weight|Package Weight|Item Weight|Weight)\s*[:\uFF1A]\s*(.+)$/i,
    );
    if (m) rows.push({ label: m[1]!, value: m[2]!.trim() });
  });

  const parsed: ParsedWeight[] = [];
  for (const row of rows) {
    const grams = parseWeightTextToGrams(row.value);
    if (grams == null || grams < 1 || grams > 200_000) continue;
    const source =
      AMAZON_LABEL_PRIORITY.find((p) => p.re.test(row.label))?.source ??
      "amazon_weight";
    parsed.push({ weightGrams: grams, source, raw: row.value });
  }
  if (parsed.length === 0) return null;
  return (
    parsed.find((c) => /shipping|package/i.test(c.source)) ?? parsed[0]!
  );
}

/**
 * Amazon 상품 상세 표/불릿 텍스트에서 무게 추출.
 * Shipping/Package Weight 우선, 없으면 Item Weight.
 */
export function extractAmazonWeightGrams(htmlOrText: string): ParsedWeight | null {
  const candidates: ParsedWeight[] = [];

  // tr / li 스타일: Label ... Value
  const rowPatterns = [
    /(?:Shipping Weight|Package Weight|Item Weight|Weight)\s*[:\uFF1A]?\s*<\/[^>]+>\s*<[^>]+>\s*([^<]{1,40})/gi,
    /(?:Shipping Weight|Package Weight|Item Weight|Weight)\s*[:\uFF1A]\s*([^\n<]{1,40})/gi,
  ];
  for (const re of rowPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(htmlOrText)) != null) {
      const label = m[0];
      const raw = m[1]!.trim();
      const grams = parseWeightTextToGrams(raw);
      if (grams == null || grams < 1 || grams > 200_000) continue;
      const source =
        AMAZON_LABEL_PRIORITY.find((p) => p.re.test(label))?.source ??
        "amazon_weight";
      candidates.push({ weightGrams: grams, source, raw });
    }
  }

  // JSON 조각
  const jsonRes = [
    /"shippingWeight"\s*:\s*\{[^}]*"value"\s*:\s*(?<v>\d+(?:\.\d+)?)[^}]*"unit"\s*:\s*"(?<u>[^"]+)"/gi,
    /"item_weight"\s*:\s*"(?<raw>[^"]+)"/gi,
  ];
  for (const re of jsonRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(htmlOrText)) != null) {
      if (m.groups?.v && m.groups?.u) {
        const grams = parseWeightTokenToGrams(Number(m.groups.v), m.groups.u);
        if (grams != null && grams >= 1 && grams <= 200_000) {
          candidates.push({
            weightGrams: grams,
            source: "amazon_json_shippingWeight",
            raw: `${m.groups.v} ${m.groups.u}`,
          });
        }
      } else if (m.groups?.raw) {
        const grams = parseWeightTextToGrams(m.groups.raw);
        if (grams != null && grams >= 1 && grams <= 200_000) {
          candidates.push({
            weightGrams: grams,
            source: "amazon_json_item_weight",
            raw: m.groups.raw,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  const shipping = candidates.find((c) =>
    /shipping|package/i.test(c.source),
  );
  return shipping ?? candidates[0]!;
}

/**
 * 1688 HTML/JSON에서 무게 추출 (净重/毛重/weight 등).
 */
export function extract1688WeightGrams(htmlOrText: string): ParsedWeight | null {
  const candidates: ParsedWeight[] = [];

  const labeled = [
    /(?:净重|毛重|商品重量|重量|包装重量)\s*[:\uFF1A]?\s*(\d+(?:\.\d+)?)\s*(kg|g|千克|公斤|克)?/gi,
    /"(?:weight|grossWeight|netWeight|packageWeight)"\s*:\s*"?(?<v>\d+(?:\.\d+)?)"?\s*(?:,[^}]*"(?:unit|weightUnit)"\s*:\s*"(?<u>[^"]+)")?/gi,
  ];

  for (const re of labeled) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(htmlOrText)) != null) {
      const value = Number(m.groups?.v ?? m[1]);
      const unit = (m.groups?.u ?? m[2] ?? "kg").toString();
      const grams = parseWeightTokenToGrams(value, unit);
      if (grams == null || grams < 1 || grams > 200_000) continue;
      const raw = `${value} ${unit}`;
      const source = /净重|net/i.test(m[0])
        ? "1688_net_weight"
        : /毛重|gross/i.test(m[0])
          ? "1688_gross_weight"
          : "1688_weight";
      candidates.push({ weightGrams: grams, source, raw });
    }
  }

  // 단위 없는 weight 숫자는 kg로 가정 (1688 관례, 0.01~50)
  const bare = htmlOrText.matchAll(
    /"(?:weight|grossWeight|netWeight)"\s*:\s*"?(?<v>\d+(?:\.\d+)?)"?/gi,
  );
  for (const m of bare) {
    const value = Number(m.groups?.v);
    if (!Number.isFinite(value) || value < 0.01 || value > 50) continue;
    // 이미 잡은 것과 중복 스킵
    const grams = parseWeightTokenToGrams(value, "kg");
    if (grams == null) continue;
    if (candidates.some((c) => c.weightGrams === grams)) continue;
    candidates.push({
      weightGrams: grams,
      source: "1688_weight_kg_assumed",
      raw: `${value} kg`,
    });
  }

  if (candidates.length === 0) return null;
  // 毛重(포장 포함) 우선 → 배대지 청구에 더 가깝다
  const gross = candidates.find((c) => /gross|毛重/i.test(c.source));
  return gross ?? candidates[0]!;
}

/** candidate.rawMetrics / costBreakdown 에서 무게 읽기 */
export function readWeightGramsFromUnknown(data: unknown): number | null {
  if (data == null || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const direct = numPositive(obj.weightGrams);
  if (direct != null) return direct;

  const quote = obj.shippingQuote;
  if (quote && typeof quote === "object") {
    const fromQuote = numPositive(
      (quote as Record<string, unknown>).weightGrams,
    );
    if (fromQuote != null) return fromQuote;
  }

  const supply = obj.supply;
  if (supply && typeof supply === "object") {
    const fromSupply = numPositive(
      (supply as Record<string, unknown>).weightGrams,
    );
    if (fromSupply != null) return fromSupply;
  }

  return null;
}

function numPositive(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
