import { describe, expect, it } from "vitest";
import { parse1688CostFromHtml } from "./fetch-1688-offer";
import {
  extract1688OfferId,
  is1688OfferUrl,
  isFake1688StubDetailUrl,
  to1688OfferUrl,
} from "./parse-1688-url";

describe("extract1688OfferId", () => {
  it("parses detail and bare ids", () => {
    expect(
      extract1688OfferId("https://detail.1688.com/offer/1234567890.html"),
    ).toBe("1234567890");
    expect(extract1688OfferId("1234567890")).toBe("1234567890");
    expect(is1688OfferUrl("https://amazon.com/dp/B0")).toBe(false);
    expect(to1688OfferUrl("1234567890")).toContain("1234567890");
  });

  it("detects fake stub detail urls that 404", () => {
    expect(
      isFake1688StubDetailUrl(
        "https://detail.1688.com/offer/1688-39661548.html",
      ),
    ).toBe(true);
    expect(
      isFake1688StubDetailUrl(
        "https://detail.1688.com/offer/798161592540.html",
      ),
    ).toBe(false);
  });
});

describe("parse1688CostFromHtml", () => {
  it("reads price and title from sample html", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="无线风扇批发" />
        <script>window.__INIT={"price":"32.5","beginAmount":"2"}</script>
      </head><body>¥32.5</body></html>
    `;
    const parsed = parse1688CostFromHtml(html);
    expect(parsed.title).toContain("风扇");
    expect(parsed.costPriceCny).toBe(32.5);
    expect(parsed.moq).toBe(2);
  });
});
