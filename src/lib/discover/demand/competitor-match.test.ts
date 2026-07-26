import { describe, expect, it } from "vitest";
import { classifyCompetitorMatch } from "./competitor-match";

describe("classifyCompetitorMatch", () => {
  it("marks same model+brand as same_likely", () => {
    const r = classifyCompetitorMatch({
      sourceTitle: "Soundcore P40i by Anker Noise Cancelling Earbuds",
      sourceBrand: "Anker",
      competitorTitle: "앤커 사운드코어 P40i 노이즈캔슬링 이어폰",
    });
    // P40i digit token should match even if Korean brand transliteration differs
    expect(r.kind).toBe("same_likely");
    expect(r.label).toBe("동일 추정");
  });

  it("marks generic category hits as similar", () => {
    const r = classifyCompetitorMatch({
      sourceTitle: "Soundcore P40i by Anker Noise Cancelling Earbuds",
      sourceBrand: "Anker",
      competitorTitle: "무선 블루투스 이어폰 노이즈캔슬링 가성비",
    });
    expect(r.kind).toBe("similar");
    expect(r.label).toBe("유사");
  });
});
