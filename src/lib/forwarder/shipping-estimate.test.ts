import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateIntlShipping } from "./shipping-estimate";

describe("estimateIntlShipping", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses thebay seller table for CN by default", () => {
    vi.stubEnv("FORWARDER_SHIPPING_MODE", "table");
    vi.stubEnv("THEBAY_AIR_TIER", "seller");
    const q = estimateIntlShipping({ region: "CN", weightGrams: 300 });
    expect(q.source).toBe("rate_table");
    expect(q.provider).toBe("thebay");
    expect(q.feeKrw).toBe(3200);
    expect(q.billableKg).toBe(0.5);
  });

  it("falls back to flat when mode=flat", () => {
    vi.stubEnv("FORWARDER_SHIPPING_MODE", "flat");
    vi.stubEnv("SHIPPING_FEE_KRW", "15000");
    const q = estimateIntlShipping({ region: "CN", weightGrams: 300 });
    expect(q.source).toBe("flat_env");
    expect(q.feeKrw).toBe(15000);
  });

  it("uses malltail table for US", () => {
    vi.stubEnv("FORWARDER_SHIPPING_MODE", "table");
    vi.stubEnv("MALLTAIL_TIER", "general");
    vi.stubEnv("USD_TO_KRW", "1380");
    vi.stubEnv("MALLTAIL_FUEL_SURCHARGE_USD", "1");
    vi.stubEnv("MALLTAIL_CENTER_FEE_USD", "0");
    const q = estimateIntlShipping({ region: "US", weightGrams: 300 });
    expect(q.source).toBe("rate_table");
    expect(q.provider).toBe("malltail");
    expect(q.billableLbs).toBe(1);
    expect(q.feeKrw).toBe(Math.round(12.99 * 1380));
    expect(q.waivedFeesUsd).toEqual({
      customsClearance: 0,
      inspection: 0,
      quarantine: 0,
    });
    expect(q.includedInsuranceUsd).toBe(15);
    expect(q.policyNotes).toEqual(
      expect.arrayContaining(["통관 수수료 무료", "검수비 무료"]),
    );
  });
});
