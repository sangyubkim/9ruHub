import { describe, expect, it } from "vitest";
import {
  assessBrandAwareness,
  assessCoupangDensityProxy,
  assessSearchMomentum,
} from "@/lib/discover/demand/market-signals";

describe("market-signals", () => {
  it("라틴 브랜드는 해외 브랜드로 본다", () => {
    const b = assessBrandAwareness({ brand: "Hydro Flask", keyword: "텀블러" });
    expect(b.isOverseasBrand).toBe(true);
    expect(b.score).toBeGreaterThan(0);
  });

  it("이어폰은 쿠팡 과열 추정", () => {
    const c = assessCoupangDensityProxy({ keyword: "무선 이어폰" });
    expect(c.estimatedSellerBand).toBe("many");
    expect(c.isStub).toBe(true);
  });

  it("검색 많고 경쟁 낮으면 모멘텀 가산", () => {
    const m = assessSearchMomentum({
      searchVolume: 8000,
      competition: 0.2,
      seasonalityScore: 75,
    });
    expect(m.score).toBeGreaterThanOrEqual(40);
  });
});
