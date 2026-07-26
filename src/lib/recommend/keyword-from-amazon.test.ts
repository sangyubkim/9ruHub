import { describe, expect, it } from "vitest";
import { keywordFromAmazonTitle } from "@/lib/recommend/keyword-from-amazon";

describe("keywordFromAmazonTitle", () => {
  it("extracts short keyword from amazon title", () => {
    const kw = keywordFromAmazonTitle(
      "Apple AirPods Pro 2 Wireless Earbuds, Active Noise Cancellation",
      "Apple",
    );
    expect(kw.toLowerCase()).toContain("airpods");
    expect(kw.length).toBeLessThanOrEqual(48);
  });

  it("returns empty for fallback titles", () => {
    expect(keywordFromAmazonTitle("[초안] Amazon US B0D1XD1ZV3")).toBe("");
  });
});
