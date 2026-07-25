import "dotenv/config";
import { createOrder, purchaseOrderItems } from "../src/lib/orders/service";
import { prisma } from "../src/lib/db";

async function main() {
  const order = await createOrder({
    channel: "SMARTSTORE",
    externalOrderId: `SMOKE-${Date.now()}`,
    items: [
      {
        title: "스모크 주문 상품",
        quantity: 1,
        unitSalePriceKrw: 10000,
        unitCostKrw: 4000,
      },
    ],
  });
  const result = await purchaseOrderItems(order.id);
  console.log(
    JSON.stringify(
      {
        orderId: order.id,
        status: result.order.status,
        purchase: result.results[0]?.status,
        mode: result.results[0]?.mode,
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
