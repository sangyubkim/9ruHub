import { describe, expect, it } from "vitest";
import {
  estimateTheBayAirShipping,
  toBillableKg,
} from "./thebay-air";

describe("thebay air rates", () => {
  it("rounds weight up to 0.5kg brackets", () => {
    expect(toBillableKg(300)).toBe(0.5);
    expect(toBillableKg(500)).toBe(0.5);
    expect(toBillableKg(501)).toBe(1.0);
    expect(toBillableKg(2000)).toBe(2.0);
  });

  it("uses seller tier from table", () => {
    expect(estimateTheBayAirShipping(300, "seller").feeKrw).toBe(3200);
    expect(estimateTheBayAirShipping(1000, "seller").feeKrw).toBe(5000);
    expect(estimateTheBayAirShipping(4000, "seller").feeKrw).toBe(15800);
    expect(estimateTheBayAirShipping(300, "vip").feeKrw).toBe(4200);
  });

  it("extrapolates above 4kg", () => {
    const q = estimateTheBayAirShipping(4500, "seller");
    expect(q.billableKg).toBe(4.5);
    expect(q.extrapolated).toBe(true);
    expect(q.feeKrw).toBe(15800 + 1800);
  });
});
