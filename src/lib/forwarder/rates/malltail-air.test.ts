import { describe, expect, it } from "vitest";
import {
  dimensionalWeightLbs,
  estimateMalltailAirShipping,
  toBillableLbs,
} from "./malltail-air";

describe("malltail air rates", () => {
  it("converts grams to billable lbs brackets", () => {
    // ~0.66 lb → 1 lb
    expect(toBillableLbs(300)).toBe(1);
    // 0.5 lb (453.59237 * 0.5)
    expect(toBillableLbs(226.79)).toBe(0.5);
    // ~1.1 lb → 2
    expect(toBillableLbs(500)).toBe(2);
  });

  it("applies 50% volumetric weight discount when dims dominate", () => {
    // 12×10×8 in → raw 6.906 → 50% = 3.453 lb → billable 4
    const dim = dimensionalWeightLbs({
      lengthIn: 12,
      widthIn: 10,
      heightIn: 8,
    });
    expect(dim.discountedLbs).toBeCloseTo(3.45, 1);
    // 실제 무게 300g(~0.66lb)보다 부피무게가 큼
    expect(toBillableLbs(300, { lengthIn: 12, widthIn: 10, heightIn: 8 })).toBe(
      4,
    );
  });

  it("quotes general + fuel, waived inspection/customs/quarantine", () => {
    const q = estimateMalltailAirShipping(300, {
      tier: "general",
      usdToKrw: 1380,
      fuelSurchargeUsd: 1,
      centerFeeUsd: 0,
    });
    // 300g → 1 lb → 11.99 + 1 = 12.99 → *1380
    expect(q.billableLbs).toBe(1);
    expect(q.baseUsd).toBe(11.99);
    expect(q.totalUsd).toBe(12.99);
    expect(q.feeKrw).toBe(Math.round(12.99 * 1380));
    expect(q.provider).toBe("malltail");
    expect(q.waivedFeesUsd).toEqual({
      customsClearance: 0,
      inspection: 0,
      quarantine: 0,
    });
    expect(q.includedInsuranceUsd).toBe(15);
    expect(q.volumetricWeightDiscount).toBe(0.5);
    expect(q.policyNotes).toEqual(
      expect.arrayContaining([
        "통관 수수료 무료",
        "검수비 무료",
        "검역비 무료",
      ]),
    );
  });
});
