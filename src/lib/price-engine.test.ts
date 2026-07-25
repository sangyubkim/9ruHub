import { describe, expect, it } from "vitest";
import { calculateSalePrice } from "./price-engine";

describe("calculateSalePrice", () => {
  it("마진/배송/관세를 반영해 판매가를 올림 계산", () => {
    const result = calculateSalePrice(20, {
      usdToKrw: 1000,
      marginRate: 0.2,
      shippingFeeKrw: 10000,
      agencyFeeKrw: 2000,
      platformFeeRate: 0.1,
      dutyRate: 0.1,
      roundTo: 100,
    });

    // source 20000 + duty 2000 + ship 10000 + agency 2000 = 34000
    // *1.2 = 40800 / 0.9 = 45333.33 → 45400
    expect(result.sourcePriceKrw).toBe(20000);
    expect(result.dutyKrw).toBe(2000);
    expect(result.salePriceKrw).toBe(45400);
  });
});
