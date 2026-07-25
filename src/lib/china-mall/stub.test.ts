import { describe, expect, it } from "vitest";
import { getChinaMallAdapter } from "@/lib/china-mall";
import { StubChinaMallAdapter } from "@/lib/china-mall/stub";

describe("china mall adapter", () => {
  it("returns stub adapter by default without charging", async () => {
    const adapter = getChinaMallAdapter();
    expect(adapter).toBeInstanceOf(StubChinaMallAdapter);
    const result = await adapter.purchase({
      orderItemId: "item12345678",
      title: "Demo",
      quantity: 1,
      sourceUrl: "https://detail.1688.com/offer/1.html",
    });
    expect(result.mode).toBe("stub");
    expect(result.success).toBe(true);
    expect(result.purchaseRef).toMatch(/^STUB-/);
  });
});
