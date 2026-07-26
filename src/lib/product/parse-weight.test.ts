import { describe, expect, it } from "vitest";
import {
  extract1688WeightGrams,
  extractAmazonWeightGrams,
  parseWeightTextToGrams,
  readWeightGramsFromUnknown,
} from "./parse-weight";

describe("parseWeightTextToGrams", () => {
  it("parses common units", () => {
    expect(parseWeightTextToGrams("500 g")).toBe(500);
    expect(parseWeightTextToGrams("1.2 kg")).toBe(1200);
    expect(parseWeightTextToGrams("1 lb")).toBe(454);
    expect(parseWeightTextToGrams("1 pound 8 ounces")).toBe(
      Math.round(453.59237 + 8 * 28.349523125),
    );
  });
});

describe("extractAmazonWeightGrams", () => {
  it("prefers shipping weight over item weight", () => {
    const html = `
      <tr><th>Item Weight</th><td>8 ounces</td></tr>
      <tr><th>Shipping Weight</th><td>1.2 pounds</td></tr>
    `;
    const w = extractAmazonWeightGrams(html);
    expect(w?.source).toMatch(/shipping/i);
    expect(w?.weightGrams).toBe(Math.round(1.2 * 453.59237));
  });
});

describe("extract1688WeightGrams", () => {
  it("parses chinese weight labels", () => {
    const html = `净重：0.35kg 毛重：0.5 千克`;
    const w = extract1688WeightGrams(html);
    expect(w?.weightGrams).toBe(500);
    expect(w?.source).toMatch(/gross|毛重/i);
  });

  it("parses json weight as kg when unit omitted", () => {
    const html = `"grossWeight":"0.8"`;
    const w = extract1688WeightGrams(html);
    expect(w?.weightGrams).toBe(800);
  });
});

describe("readWeightGramsFromUnknown", () => {
  it("reads nested shippingQuote / supply", () => {
    expect(readWeightGramsFromUnknown({ weightGrams: 320 })).toBe(320);
    expect(
      readWeightGramsFromUnknown({ shippingQuote: { weightGrams: 450 } }),
    ).toBe(450);
    expect(
      readWeightGramsFromUnknown({ supply: { weightGrams: 600 } }),
    ).toBe(600);
  });
});
