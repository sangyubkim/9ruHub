import { describe, expect, it } from "vitest";
import { Channel, ShipmentStatus } from "@/generated/prisma/client";
import {
  nextForwarderSyncAction,
  parseChannelList,
} from "@/lib/shipments/invoice-pipeline-state";
import {
  stubForwarderTrackingNo,
  stubLocalTracking,
} from "@/lib/forwarder/stub";
import { getForwarderAdapter } from "@/lib/forwarder";
import { getChannelInvoiceAdapter } from "@/lib/channels/invoice";

describe("invoice pipeline state machine", () => {
  it("maps shipment status to next forwarder action", () => {
    expect(nextForwarderSyncAction(ShipmentStatus.PENDING, false)).toBe(
      "pollInbound",
    );
    expect(nextForwarderSyncAction(ShipmentStatus.AT_FORWARDER, false)).toBe(
      "pollOutbound",
    );
    expect(nextForwarderSyncAction(ShipmentStatus.IN_TRANSIT, false)).toBe(
      "fetchTrackingNumber",
    );
    expect(nextForwarderSyncAction(ShipmentStatus.IN_TRANSIT, true)).toBe(
      "track",
    );
    expect(nextForwarderSyncAction(ShipmentStatus.DELIVERED, true)).toBe(
      "noop",
    );
    expect(nextForwarderSyncAction(ShipmentStatus.CANCELLED, false)).toBe(
      "noop",
    );
  });

  it("parses channel list for register-invoice", () => {
    expect(parseChannelList(["smartstore", "ELEVENST"])).toEqual([
      Channel.SMARTSTORE,
      Channel.ELEVENST,
    ]);
    expect(parseChannelList(["UNKNOWN"])).toBeUndefined();
    expect(parseChannelList(null)).toBeUndefined();
  });
});

describe("stub forwarder deterministic demo", () => {
  it("polls inbound → outbound → tracking without API keys", async () => {
    const adapter = getForwarderAdapter();
    const shipmentId = "shipDemo12345";

    const inbound = await adapter.pollInbound(shipmentId);
    expect(inbound.mode).toBe("stub");
    expect(inbound.status).toBe("AT_FORWARDER");
    expect(inbound.forwarderTrackingNo).toBe(
      stubForwarderTrackingNo(shipmentId),
    );

    const outbound = await adapter.pollOutbound(
      shipmentId,
      inbound.forwarderTrackingNo,
    );
    expect(outbound.status).toBe("IN_TRANSIT");
    expect(outbound.localTrackingNo).toBe(
      stubLocalTracking(shipmentId).localTrackingNo,
    );

    const tracking = await adapter.fetchTrackingNumber(shipmentId);
    expect(tracking.localTrackingNo).toMatch(/^KR/);
    expect(tracking.localCarrier).toBe("CJ대한통운");
  });
});

describe("channel invoice stubs", () => {
  it("registers to smartstore / coupang / elevenst in stub mode", async () => {
    for (const channel of [
      Channel.SMARTSTORE,
      Channel.COUPANG,
      Channel.ELEVENST,
    ]) {
      const adapter = getChannelInvoiceAdapter(channel);
      const result = await adapter.registerInvoice({
        orderExternalId: "ORD-1",
        localCarrier: "CJ대한통운",
        localTrackingNo: "KR1234567890",
      });
      expect(result.success).toBe(true);
      expect(result.mode).toBe("stub");
      expect(result.status).toBe("STUBBED");
    }
  });
});
