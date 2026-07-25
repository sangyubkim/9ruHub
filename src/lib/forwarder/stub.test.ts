import { describe, expect, it } from "vitest";
import { getForwarderAdapter } from "@/lib/forwarder";
import { getInvoiceRegisterAdapter } from "@/lib/invoice";
import { stubForwarderTrackingNo } from "@/lib/forwarder/stub";

describe("forwarder + invoice stubs", () => {
  it("creates inbound tracking stub", async () => {
    const adapter = getForwarderAdapter();
    const result = await adapter.createInbound({
      orderId: "ord1",
      shipmentId: "ship12345678",
    });
    expect(result.mode).toBe("stub");
    expect(result.trackingNo).toBe(stubForwarderTrackingNo("ship12345678"));
  });

  it("registers channel invoice as stub", async () => {
    const adapter = getInvoiceRegisterAdapter();
    const result = await adapter.register({
      channel: "SMARTSTORE",
      localCarrier: "CJ",
      localTrackingNo: "1234567890",
    });
    expect(result.status).toBe("STUBBED");
    expect(result.success).toBe(true);
  });
});
