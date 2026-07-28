import { describe, expect, it } from "vitest";
import { assessCsRisk } from "@/lib/recommend/cs-risk";

describe("assessCsRisk", () => {
  it("배터리는 고위험", () => {
    const r = assessCsRisk({ keyword: "리튬 배터리 보조배터리", weightGrams: 400 });
    expect(r.level).toBe("high");
  });

  it("일반 경량 상품은 낮음", () => {
    const r = assessCsRisk({
      keyword: "캠핑 랜턴 악세서리",
      weightGrams: 300,
    });
    expect(r.level).toBe("low");
  });

  it("과중량은 위험 상승", () => {
    const r = assessCsRisk({ keyword: "캠핑 의자", weightGrams: 6000 });
    expect(["medium", "high"]).toContain(r.level);
  });
});
