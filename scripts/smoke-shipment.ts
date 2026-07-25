import "dotenv/config";
import { createOrder } from "../src/lib/orders/service";
import {
  createShipmentForOrder,
  registerChannelInvoice,
  trackShipment,
} from "../src/lib/shipments/service";
import { prisma } from "../src/lib/db";

async function main() {
  const order = await createOrder({
    channel: "SMARTSTORE",
    externalOrderId: `SHIP-${Date.now()}`,
    items: [
      {
        title: "물류 스모크",
        quantity: 1,
        unitSalePriceKrw: 40000,
        unitCostKrw: 20000,
      },
    ],
  });
  const created = await createShipmentForOrder(order.id, {
    weightGrams: 400,
    shippingCostKrw: 7000,
  });
  const tracked = await trackShipment(created.shipment.id);
  const invoiced = await registerChannelInvoice(created.shipment.id, {
    localCarrier: "CJ대한통운",
    localTrackingNo: `KR${Date.now()}`,
  });
  console.log(
    JSON.stringify(
      {
        shipmentId: created.shipment.id,
        forwarder: created.forwarder.trackingNo,
        trackStatus: tracked.track.status,
        invoice: invoiced.invoice.status,
        channelInvoiceStatus: invoiced.shipment.channelInvoiceStatus,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
