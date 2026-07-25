import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma-pg";

async function main() {
  const prisma = createPrismaClient();
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error("tenant missing");

    const [shipments, orders] = await Promise.all([
      prisma.shipment.findMany({
        where: { tenantId: tenant.id },
        include: { order: { include: { items: true } } },
        take: 100,
      }),
      prisma.order.findMany({
        where: { tenantId: tenant.id, status: { notIn: ["CANCELLED"] } },
        include: { items: true },
      }),
    ]);

    console.log("OK", { shipments: shipments.length, orders: orders.length });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
