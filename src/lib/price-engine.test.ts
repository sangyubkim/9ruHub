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
      cardFeeRate: 0,
    });

    // source 20000 + duty 2000 + ship 10000 + agency 2000 = 34000
    // *1.2 = 40800 / 0.9 = 45333.33 → 45400
    expect(result.sourcePriceKrw).toBe(20000);
    expect(result.dutyKrw).toBe(2000);
    expect(result.salePriceKrw).toBe(45400);
    expect(result.chinaShippingKrw).toBe(0);
    expect(result.intlShippingKrw).toBe(10000);
  });

  it("중국/국제 배송 분리 + 카드수수료 반영", () => {
    const result = calculateSalePrice(20, {
      usdToKrw: 1000,
      marginRate: 0.2,
      shippingFeeKrw: 0,
      chinaShippingFeeKrw: 3000,
      intlShippingFeeKrw: 7000,
      agencyFeeKrw: 2000,
      platformFeeRate: 0.1,
      cardFeeRate: 0.025,
      dutyRate: 0.1,
      roundTo: 100,
    });
    // 20000+2000+3000+7000+2000=34000 *1.2 / 0.875 = 46500ish → 46600? 
    // 40800/0.875 = 46628.57 → 46700
    expect(result.shippingFeeKrw).toBe(10000);
    expect(result.salePriceKrw).toBe(46700);
  });
});
