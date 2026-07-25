import * as cheerio from "cheerio";
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
  isFallback: boolean;
  raw?: Record<string, unknown>;
};

function fallbackProduct(asin: string, sourceUrl: string): FetchedProduct {
  return {
    asin,
    sourceUrl,
    title: `[초안] Amazon US ${asin}`,
    brand: null,
    currency: "USD",
    sourcePrice: 29.99,
    inStock: true,
    images: [`https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`],
    options: [
      { name: "Color", values: ["Default"] },
      { name: "Size", values: ["One Size"] },
    ],
    isFallback: true,
    raw: { reason: "amazon_fetch_unavailable" },
  };
}

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
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
    const $ = cheerio.load(html);

    const title =
      $("#productTitle").text().trim() ||
      $("meta[property='og:title']").attr("content")?.trim() ||
      "";

    const brand =
      $("#bylineInfo").text().replace(/^Visit the |^Brand:\s*/i, "").trim() ||
      $("a#brand").text().trim() ||
      null;

    const price =
      parsePrice($(".a-price .a-offscreen").first().text()) ??
      parsePrice($("#priceblock_ourprice").text()) ??
      parsePrice($("#priceblock_dealprice").text()) ??
      parsePrice($("#corePrice_feature_div .a-offscreen").first().text());

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
      isFallback: false,
      raw: { title, brand, price },
    };
  } catch {
    return fallbackProduct(asin, sourceUrl);
  }
}
