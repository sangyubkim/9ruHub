import * as cheerio from "cheerio";
import {
  AMAZON_FALLBACK_PRICE_USD,
  amazonFallbackTitle,
} from "@/lib/amazon/fallback";
import {
  extractAmazonWeightFromDom,
  extractAmazonWeightGrams,
} from "@/lib/product/parse-weight";
import { extractAsin, toAmazonUsUrl } from "./parse-url";

export type FetchedOption = {
  name: string;
  values: string[];
};

export type FetchedProduct = {
  asin: string;
  sourceUrl: string;
  title: string;
  brand: string | null;
  currency: string;
  sourcePrice: number;
  inStock: boolean;
  images: string[];
  options: FetchedOption[];
  /** 파싱된 무게(g). Shipping Weight 우선 */
  weightGrams?: number | null;
  isFallback: boolean;
  raw?: Record<string, unknown>;
};

function fallbackProduct(asin: string, sourceUrl: string): FetchedProduct {
  return {
    asin,
    sourceUrl,
    title: amazonFallbackTitle(asin),
    brand: null,
    currency: "USD",
    sourcePrice: AMAZON_FALLBACK_PRICE_USD,
    inStock: true,
    images: [
      `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`,
    ],
    options: [
      { name: "Color", values: ["Default"] },
      { name: "Size", values: ["One Size"] },
    ],
    isFallback: true,
    raw: { reason: "amazon_fetch_unavailable" },
  };
}

export function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function looksLikeAmazonBlockPage(html: string): boolean {
  return /api-services-support@amazon\.com|Enter the characters you see below|Robot Check|sorry, we just need to make sure you're not a robot/i.test(
    html,
  );
}

/** 여러 셀렉터·JSON에서 가격 후보를 뽑는다 */
export function extractAmazonPriceFromHtml(
  $: ReturnType<typeof cheerio.load>,
  html: string,
): number | null {
  const candidates = [
    $(".a-price[data-a-color='price'] .a-offscreen").first().text(),
    $("#corePrice_feature_div .a-price .a-offscreen").first().text(),
    $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text(),
    $(".a-price .a-offscreen").first().text(),
    $("#priceblock_ourprice").text(),
    $("#priceblock_dealprice").text(),
    $("#price_inside_buybox").text(),
    $("input#twister-plus-price-data-price").attr("value"),
    $("span[data-a-color='price'] .a-offscreen").first().text(),
  ];

  for (const c of candidates) {
    const p = parsePrice(c ?? undefined);
    if (p != null) return p;
  }

  const whole = $(".a-price-whole").first().text().replace(/[^0-9]/g, "");
  const fraction = $(".a-price-fraction").first().text().replace(/[^0-9]/g, "");
  if (whole) {
    const p = parsePrice(`${whole}.${fraction || "00"}`);
    if (p != null) return p;
  }

  const jsonPrice = html.match(
    /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
  );
  if (jsonPrice?.[1]) {
    const p = parsePrice(jsonPrice[1]);
    if (p != null) return p;
  }

  return null;
}

/**
 * Amazon US 상품 페이지를 수집한다.
 * 차단/파싱 실패 시 ASIN 기반 폴백 초안을 반환해 워크플로가 멈추지 않게 한다.
 */
export async function fetchAmazonUsProduct(inputUrl: string): Promise<FetchedProduct> {
  const asin = extractAsin(inputUrl);
  if (!asin) {
    throw new Error("유효한 Amazon US URL 또는 ASIN이 아닙니다.");
  }

  const sourceUrl = toAmazonUsUrl(asin);

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    if (!res.ok) {
      return fallbackProduct(asin, sourceUrl);
    }

    const html = await res.text();
    if (looksLikeAmazonBlockPage(html)) {
      return fallbackProduct(asin, sourceUrl);
    }

    const $ = cheerio.load(html);

    const title =
      $("#productTitle").text().trim() ||
      $("meta[property='og:title']").attr("content")?.trim() ||
      "";

    const brand =
      $("#bylineInfo").text().replace(/^Visit the |^Brand:\s*/i, "").trim() ||
      $("a#brand").text().trim() ||
      null;

    const price = extractAmazonPriceFromHtml($, html);

    const images = new Set<string>();
    const landing = $("#landingImage").attr("src") || $("#imgTagWrapperId img").attr("src");
    if (landing) images.add(landing);

    const dynamic = $("#landingImage").attr("data-a-dynamic-image");
    if (dynamic) {
      try {
        const map = JSON.parse(dynamic) as Record<string, unknown>;
        Object.keys(map).forEach((url) => images.add(url));
      } catch {
        /* ignore */
      }
    }

    $("img[data-old-hires]").each((_, el) => {
      const src = $(el).attr("data-old-hires") || $(el).attr("src");
      if (src?.startsWith("http")) images.add(src);
    });

    const options: FetchedOption[] = [];
    $("#twister .a-form-label, #twister .dimtitle").each((_, el) => {
      const name = $(el).text().replace(/:$/, "").trim();
      if (!name) return;
      const values: string[] = [];
      $(el)
        .closest("div")
        .find("li span.a-size-base, option")
        .each((__, opt) => {
          const v = $(opt).text().trim();
          if (v && !values.includes(v)) values.push(v);
        });
      if (values.length) options.push({ name, values });
    });

    const availability = $("#availability").text().toLowerCase();
    const inStock = !availability.includes("unavailable") && !availability.includes("out of stock");

    if (!title || !price) {
      return fallbackProduct(asin, sourceUrl);
    }

    const weight =
      extractAmazonWeightFromDom({
        root: (sel) => $(sel),
        text: (el) => $(el as never).text(),
      }) ?? extractAmazonWeightGrams(html);

    return {
      asin,
      sourceUrl,
      title,
      brand,
      currency: "USD",
      sourcePrice: price,
      inStock,
      images: [...images].slice(0, 10),
      options: options.length
        ? options
        : [{ name: "Option", values: ["Default"] }],
      weightGrams: weight?.weightGrams ?? null,
      isFallback: false,
      raw: {
        title,
        brand,
        price,
        weightGrams: weight?.weightGrams ?? null,
        weightSource: weight?.source ?? null,
        weightRaw: weight?.raw ?? null,
      },
    };
  } catch {
    return fallbackProduct(asin, sourceUrl);
  }
}
