import * as cheerio from "cheerio";
import { SupplyMall } from "@/generated/prisma/client";
import type { SupplyOffer } from "@/lib/discover/types";
import {
  extract1688OfferId,
  to1688OfferUrl,
} from "@/lib/discover/supply/parse-1688-url";
import { extract1688WeightGrams } from "@/lib/product/parse-weight";

export type Fetched1688Offer = SupplyOffer & {
  isFallback: boolean;
  fetchError?: string;
};

/**
 * HTML/JSON 조각에서 CNY 단가 후보를 뽑는다.
 * 1688은 JS 렌더·차단이 많아 best-effort + 수동 원가 폴백.
 */
export function parse1688CostFromHtml(html: string): {
  costPriceCny: number | null;
  title: string | null;
  moq: number | null;
  weightGrams: number | null;
  weightSource: string | null;
} {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    null;

  const candidates: number[] = [];

  const ogPrice =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content");
  pushPrice(candidates, ogPrice);

  // 흔한 인라인 JSON 키
  const patterns = [
    /"price"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
    /"discountPrice"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
    /"priceInfo"\s*:\s*\{[^}]*"price"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
    /"minPrice"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
    /"offerPrice"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) != null) {
      pushPrice(candidates, m.groups?.p ?? m[1]);
      if (candidates.length > 40) break;
    }
  }

  const textPrice = html.match(
    /¥\s*(\d+(?:\.\d+)?)|￥\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*元/,
  );
  if (textPrice) {
    pushPrice(candidates, textPrice[1] ?? textPrice[2] ?? textPrice[3]);
  }

  const moqMatch = html.match(/"beginAmount"\s*:\s*"?(?<m>\d+)"?/i);
  const moq = moqMatch?.groups?.m ? Number(moqMatch.groups.m) : null;

  const weight = extract1688WeightGrams(html);
  const costPriceCny = pickReasonablePrice(candidates);
  return {
    costPriceCny,
    title: title && !/验证|登录|login/i.test(title) ? title.slice(0, 200) : null,
    moq: moq && Number.isFinite(moq) ? moq : null,
    weightGrams: weight?.weightGrams ?? null,
    weightSource: weight?.source ?? null,
  };
}

function pushPrice(out: number[], raw: string | undefined | null) {
  if (!raw) return;
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return;
  out.push(Math.round(n * 100) / 100);
}

/** 너무 싸거나 광고성 이상치를 피하고 중앙값 근처 선택 */
function pickReasonablePrice(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const filtered = prices.filter((p) => p >= 0.5 && p <= 50000);
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/**
 * 1688 상품 URL(또는 offer id)에서 공급 오퍼를 만든다.
 * 파싱 실패 시 costPriceCnyOverride가 있으면 그 값으로 live 처리.
 */
export async function fetch1688Offer(
  inputUrl: string,
  options?: { costPriceCnyOverride?: number; titleHint?: string },
): Promise<Fetched1688Offer> {
  const offerId = extract1688OfferId(inputUrl);
  if (!offerId) {
    throw new Error("유효한 1688 상품 URL 또는 offer id가 필요합니다.");
  }

  const supplyUrl = to1688OfferUrl(offerId);
  const override = options?.costPriceCnyOverride;
  if (override != null) {
    if (!Number.isFinite(override) || override <= 0) {
      throw new Error("수동 원가(CNY)는 0보다 큰 숫자여야 합니다.");
    }
  }

  try {
    const res = await fetch(supplyUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      return fallbackOffer(offerId, supplyUrl, override, options?.titleHint, {
        fetchError: `http_${res.status}`,
      });
    }

    const html = await res.text();
    const parsed = parse1688CostFromHtml(html);
    const cost =
      parsed.costPriceCny ??
      (override != null ? round2(override) : null);

    if (cost == null) {
      return fallbackOffer(offerId, supplyUrl, override, options?.titleHint, {
        fetchError: "price_not_found",
        parsedTitle: parsed.title,
      });
    }

    const usedOverride =
      parsed.costPriceCny == null && override != null;

    return {
      mall: SupplyMall.MALL_1688,
      title: parsed.title ?? options?.titleHint ?? `1688 offer ${offerId}`,
      supplyUrl,
      externalSupplyId: offerId,
      costPriceCny: cost,
      moq: parsed.moq ?? undefined,
      weightGrams: parsed.weightGrams,
      isStub: false,
      isFallback: usedOverride,
      raw: {
        provider: "mall1688-url-fetch",
        usedOverride,
        parsedCost: parsed.costPriceCny,
        source: usedOverride ? "manual_override" : "html_parse",
        weightGrams: parsed.weightGrams,
        weightSource: parsed.weightSource,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (override != null) {
      return fallbackOffer(offerId, supplyUrl, override, options?.titleHint, {
        fetchError: message,
      });
    }
    throw new Error(
      `1688 원가 수집 실패: ${message}. URL과 함께 수동 원가(CNY)를 입력하세요.`,
    );
  }
}

function fallbackOffer(
  offerId: string,
  supplyUrl: string,
  override: number | undefined,
  titleHint: string | undefined,
  meta: Record<string, unknown>,
): Fetched1688Offer {
  if (override == null || !Number.isFinite(override) || override <= 0) {
    throw new Error(
      "1688 페이지에서 가격을 읽지 못했습니다. 수동 원가(CNY)를 입력해 주세요.",
    );
  }
  return {
    mall: SupplyMall.MALL_1688,
    title: titleHint ?? `1688 offer ${offerId}`,
    supplyUrl,
    externalSupplyId: offerId,
    costPriceCny: round2(override),
    isStub: false,
    isFallback: true,
    fetchError: typeof meta.fetchError === "string" ? meta.fetchError : undefined,
    raw: {
      provider: "mall1688-url-fetch",
      source: "manual_override",
      ...meta,
    },
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
