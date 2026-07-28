import { describe, expect, it } from "vitest";
import {
  parseWishlistLines,
  WISHLIST_MAX_ITEMS,
} from "@/lib/recommend/wishlist-bulk-parse";

describe("parseWishlistLines", () => {
  it("URL·ASIN·주석·빈줄을 파싱한다", () => {
    const text = `
# wishlist
https://www.amazon.com/dp/B0D1XD1ZV3
B09B8V1LZ3

not-a-url
`;
    const { items, invalid, truncated } = parseWishlistLines(text);
    expect(truncated).toBe(false);
    expect(items.map((i) => i.asin)).toEqual(["B0D1XD1ZV3", "B09B8V1LZ3"]);
    expect(items[0]?.url).toBe("https://www.amazon.com/dp/B0D1XD1ZV3");
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.status).toBe("invalid");
  });

  it("중복 ASIN은 스킵한다", () => {
    const { items, invalid } = parseWishlistLines(
      "B0D1XD1ZV3\nhttps://www.amazon.com/dp/B0D1XD1ZV3",
    );
    expect(items).toHaveLength(1);
    expect(invalid[0]?.status).toBe("skipped");
    expect(invalid[0]?.reason).toContain("중복");
  });

  it(`한 번에 최대 ${WISHLIST_MAX_ITEMS}건`, () => {
    const lines = Array.from({ length: WISHLIST_MAX_ITEMS + 2 }, (_, i) => {
      const n = String(i).padStart(8, "0");
      return `B0${n}`;
    });
    const { items, truncated, invalid } = parseWishlistLines(lines.join("\n"));
    expect(items).toHaveLength(WISHLIST_MAX_ITEMS);
    expect(truncated).toBe(true);
    expect(
      invalid.filter((r) => r.reason?.includes(`최대 ${WISHLIST_MAX_ITEMS}`)),
    ).toHaveLength(2);
  });
});
