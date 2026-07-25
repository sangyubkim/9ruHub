import "dotenv/config";
import { createOrder } from "../src/lib/orders/service";
import {
  confirmAutoOrderPayment,
  startAutoOrder,
} from "../src/lib/orders/auto-order";
import { prisma } from "../src/lib/db";

async function main() {
  process.env.AUTO_ORDER_STUB_DELAY_MS = "0";

  const order = await createOrder({
    channel: "SMARTSTORE",
    externalOrderId: `AUTO-${Date.now()}`,
    items: [
      {
        title: "자동주문 스모크 상품",
        quantity: 1,
        unitSalePriceKrw: 12000,
        unitCostKrw: 4500,
        sourceUrl: "https://detail.1688.com/offer/smoke.html",
      },
    ],
  });

  const started = await startAutoOrder(order.id);
  if (started.order.status !== "AWAITING_PAYMENT_CONFIRM") {
    throw new Error(`expected AWAITING_PAYMENT_CONFIRM, got ${started.order.status}`);
  }

  let rejected = false;
  try {
    await confirmAutoOrderPayment(order.id, { confirmPayment: false });
  } catch {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("confirmPayment gate must reject without true");
  }

  const finished = await confirmAutoOrderPayment(order.id, {
    confirmPayment: true,
  });
  if (finished.order.status !== "PURCHASE_COMPLETE") {
    throw new Error(`expected PURCHASE_COMPLETE, got ${finished.order.status}`);
  }

  const events = finished.order.events ?? [];
  console.log(
    JSON.stringify(
      {
        ok: true,
        orderId: order.id,
        status: finished.order.status,
        eventCount: events.length,
        steps: events.map((e) => e.step),
        stoppedAt: started.stoppedAt,
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
