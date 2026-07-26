import { describe, expect, it } from "vitest";
import { build1688SearchUrl, parse1688SearchHtml } from "./search-1688";

describe("parse1688SearchHtml", () => {
  it("extracts offer ids, titles and prices from html fragments", () => {
    const html = `
      <a href="https://detail.1688.com/offer/1234567890123.html">x</a>
      {"offerId":"1234567890123","subject":"无线风扇批发","price":"23.5"}
      {"offerId":"9876543210987","title":"迷你风扇","discountPrice":"18"}
      https://detail.1688.com/offer/9876543210987.html ¥ 18.00
    `;
    const hits = parse1688SearchHtml(html, 5);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const a = hits.find((h) => h.offerId === "1234567890123");
    expect(a?.title).toContain("风扇");
    expect(a?.costPriceCny).toBe(23.5);
    const b = hits.find((h) => h.offerId === "9876543210987");
    expect(b?.costPriceCny).toBe(18);
  });

  it("builds search url", () => {
    expect(build1688SearchUrl("无线风扇")).toContain(
      encodeURIComponent("无线风扇"),
    );
  });
});
