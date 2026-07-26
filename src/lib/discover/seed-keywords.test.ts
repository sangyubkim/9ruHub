import { describe, expect, it } from "vitest";
import {
  getSeedKeywords,
  listSeedCategories,
  uniqKeywords,
} from "./seed-keywords";

describe("seed keywords", () => {
  it("lists categories and unique seeds", () => {
    expect(listSeedCategories().length).toBeGreaterThanOrEqual(5);
    const all = getSeedKeywords({ category: "all" });
    expect(all.length).toBeGreaterThanOrEqual(20);
    const camping = getSeedKeywords({ category: "camping" });
    expect(camping.every((r) => r.category === "camping")).toBe(true);
    expect(getSeedKeywords({ limit: 5 })).toHaveLength(5);
  });

  it("uniqKeywords normalizes spaces", () => {
    expect(uniqKeywords(["무선 선풍기", "무선선풍기", "캠핑의자"])).toEqual([
      "무선 선풍기",
      "캠핑의자",
    ]);
  });
});
