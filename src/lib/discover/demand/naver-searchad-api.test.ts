import { describe, expect, it } from "vitest";
import {
  buildSearchAdSignature,
  competitionFromCompIdx,
  parseQcCount,
  pickSearchVolume,
} from "./naver-searchad-api";
import { competitionFromShopTotal } from "./naver-shop-api";

describe("parseQcCount", () => {
  it("parses numbers and <10 strings", () => {
    expect(parseQcCount(1200)).toBe(1200);
    expect(parseQcCount("3,450")).toBe(3450);
    expect(parseQcCount("< 10")).toBe(5);
  });
});

describe("pickSearchVolume", () => {
  it("prefers exact keyword match", () => {
    const picked = pickSearchVolume("무선선풍기", [
      { relKeyword: "선풍기", monthlyPcQcCnt: 100, monthlyMobileQcCnt: 200 },
      {
        relKeyword: "무선선풍기",
        monthlyPcQcCnt: 1000,
        monthlyMobileQcCnt: 4000,
      },
    ]);
    expect(picked.searchVolume).toBe(5000);
    expect(picked.matchedKeyword).toBe("무선선풍기");
  });
});

describe("competition helpers", () => {
  it("maps shop total and compIdx", () => {
    expect(competitionFromShopTotal(0)).toBe(0.15);
    expect(competitionFromShopTotal(1_000_000)).toBeGreaterThan(0.7);
    expect(competitionFromCompIdx("높음")).toBe(0.8);
    expect(competitionFromCompIdx("낮음")).toBe(0.25);
  });
});

describe("buildSearchAdSignature", () => {
  it("is stable hmac-sha256 base64", () => {
    const sig = buildSearchAdSignature(
      "1710000000000",
      "GET",
      "/keywordstool",
      "test-secret",
    );
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(
      buildSearchAdSignature(
        "1710000000000",
        "GET",
        "/keywordstool",
        "test-secret",
      ),
    ).toBe(sig);
  });
});
