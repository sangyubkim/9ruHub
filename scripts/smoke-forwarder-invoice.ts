import "dotenv/config";
import { createOrder } from "../src/lib/orders/service";
import {
  createShipmentForOrder,
  registerInvoiceToChannels,
  syncShipmentFromForwarder,
} from "../src/lib/shipments/service";
import { prisma } from "../src/lib/db";
import { Channel } from "../src/generated/prisma/client";

async function main() {
  const order = await createOrder({
    channel: "SMARTSTORE",
    externalOrderId: `FWD-INV-${Date.now()}`,
    items: [
      {
        title: "배대지·송장 파이프라인 스모크",
        quantity: 1,
        unitSalePriceKrw: 45000,
        unitCostKrw: 22000,
      },
    ],
  });

  const created = await createShipmentForOrder(order.id, {
    weightGrams: 500,
    shippingCostKrw: 8000,
  });

  // createShipment already leaves AT_FORWARDER — sync advances outbound + tracking
  const synced = await syncShipmentFromForwarder(created.shipment.id);
  const invoiced = await registerInvoiceToChannels(synced.shipment.id, {
    channels: [Channel.SMARTSTORE, Channel.COUPANG, Channel.ELEVENST],
  });

  console.log(
    JSON.stringify(
      {
        shipmentId: created.shipment.id,
        afterCreate: created.shipment.status,
        afterSync: synced.shipment.status,
        localTrackingNo: synced.shipment.localTrackingNo,
        channelInvoiceStatus: invoiced.channelInvoiceStatus,
        channels: invoiced.channels,
        steps: synced.steps.map((s) => s.step),
      },
      null,
      2,
    ),
  );

  if (!synced.shipment.localTrackingNo) {
    throw new Error("expected local tracking after sync");
  }
  if (invoiced.channelInvoiceStatus === "NOT_REQUESTED") {
    throw new Error("expected invoice registration");
  }
  console.log("SMOKE_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
