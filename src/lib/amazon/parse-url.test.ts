import { describe, expect, it } from "vitest";
import { extractAsin, isAmazonUsUrl, toAmazonUsUrl } from "./parse-url";

describe("extractAsin", () => {
  it("dp URL에서 ASIN 추출", () => {
    expect(extractAsin("https://www.amazon.com/dp/B0D1XD1ZV3")).toBe("B0D1XD1ZV3");
  });

  it("gp/product URL에서 ASIN 추출", () => {
    expect(
      extractAsin("https://www.amazon.com/gp/product/B09B8V1LZ3/ref=xx"),
    ).toBe("B09B8V1LZ3");
  });

  it("순수 ASIN 허용", () => {
    expect(extractAsin("b0d1xd1zv3")).toBe("B0D1XD1ZV3");
  });

  it("비아마존 URL은 null", () => {
    expect(extractAsin("https://example.com/dp/B0D1XD1ZV3")).toBeNull();
  });
});

describe("amazon helpers", () => {
  it("US URL 판별", () => {
    expect(isAmazonUsUrl("https://www.amazon.com/dp/B0D1XD1ZV3")).toBe(true);
    expect(isAmazonUsUrl("https://www.amazon.co.jp/dp/B0D1XD1ZV3")).toBe(false);
  });

  it("정규화 URL 생성", () => {
    expect(toAmazonUsUrl("B0D1XD1ZV3")).toBe("https://www.amazon.com/dp/B0D1XD1ZV3");
  });
});
