import { describe, expect, it } from "vitest";
import { getMall1688Adapter } from "@/lib/orders/auto-order/adapter";
import { StubMall1688Adapter } from "@/lib/orders/auto-order/stub-adapter";
import { getForwarderAddress } from "@/lib/orders/auto-order/forwarder-address";

describe("auto-order stub adapter", () => {
  it("defaults to stub without live credentials", async () => {
    const prev = process.env.AUTO_ORDER_ADAPTER;
    const prevLive = process.env.AUTO_ORDER_LIVE;
    process.env.AUTO_ORDER_ADAPTER = "stub";
    delete process.env.AUTO_ORDER_LIVE;

    const adapter = getMall1688Adapter();
    expect(adapter).toBeInstanceOf(StubMall1688Adapter);

    const cart = await adapter.addToCart([
      {
        orderItemId: "item1",
        title: "demo",
        quantity: 1,
        sourceUrl: "https://detail.1688.com/offer/1.html",
      },
    ]);
    expect(cart.mode).toBe("stub");
    expect(cart.success).toBe(true);

    await expect(
      adapter.pay("order1", { confirmPayment: true }),
    ).resolves.toMatchObject({ success: true, mode: "stub" });

    process.env.AUTO_ORDER_ADAPTER = prev;
    process.env.AUTO_ORDER_LIVE = prevLive;
  });

  it("reads forwarder address from env placeholders", () => {
    const prev = process.env.FORWARDER_ADDRESS_NAME;
    process.env.FORWARDER_ADDRESS_NAME = "Test WH";
    const addr = getForwarderAddress();
    expect(addr.name).toBe("Test WH");
    process.env.FORWARDER_ADDRESS_NAME = prev;
  });
});
