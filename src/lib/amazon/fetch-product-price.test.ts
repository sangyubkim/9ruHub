import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import {
  extractAmazonPriceFromHtml,
  parsePrice,
} from "@/lib/amazon/fetch-product";
import {
  AMAZON_FALLBACK_PRICE_USD,
  amazonFallbackTitle,
  isAmazonFallbackTitle,
} from "@/lib/amazon/fallback";

describe("amazon price parse helpers", () => {
  it("parses offscreen price", () => {
    const html = `
      <span class="a-price"><span class="a-offscreen">$263.86</span></span>
    `;
    const $ = cheerio.load(html);
    expect(extractAmazonPriceFromHtml($, html)).toBe(263.86);
  });

  it("parses priceAmount json", () => {
    const html = `{"priceAmount":19.99,"currency":"USD"}`;
    const $ = cheerio.load("<div/>");
    expect(extractAmazonPriceFromHtml($, html)).toBe(19.99);
  });

  it("parsePrice rejects junk", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("$0")).toBeNull();
    expect(parsePrice("$12.50")).toBe(12.5);
  });

  it("detects fallback titles", () => {
    expect(isAmazonFallbackTitle(amazonFallbackTitle("B0D1XD1ZV3"))).toBe(
      true,
    );
    expect(isAmazonFallbackTitle("Apple AirPods Pro 2")).toBe(false);
    expect(AMAZON_FALLBACK_PRICE_USD).toBe(29.99);
  });
});
