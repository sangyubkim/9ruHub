import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { MemberRole, PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    create: { slug: "demo", name: "Demo Tenant" },
    update: { name: "Demo Tenant" },
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@sourcing-hub.local" },
    create: { email: "demo@sourcing-hub.local", name: "Demo Owner" },
    update: { name: "Demo Owner" },
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: user.id },
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: MemberRole.OWNER,
    },
    update: { role: MemberRole.OWNER },
  });

  await prisma.priceRule.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "default" },
    },
    create: {
      tenantId: tenant.id,
      name: "default",
      usdToKrw: Number(process.env.USD_TO_KRW ?? 1380),
      marginRate: Number(process.env.MARGIN_RATE ?? 0.2),
      shippingFeeKrw: Number(process.env.SHIPPING_FEE_KRW ?? 15000),
      agencyFeeKrw: Number(process.env.AGENCY_FEE_KRW ?? 3000),
      platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.1),
      dutyRate: Number(process.env.DUTY_RATE ?? 0.08),
      roundTo: 100,
    },
    update: {
      usdToKrw: Number(process.env.USD_TO_KRW ?? 1380),
      marginRate: Number(process.env.MARGIN_RATE ?? 0.2),
      shippingFeeKrw: Number(process.env.SHIPPING_FEE_KRW ?? 15000),
      agencyFeeKrw: Number(process.env.AGENCY_FEE_KRW ?? 3000),
      platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.1),
      dutyRate: Number(process.env.DUTY_RATE ?? 0.08),
    },
  });

  console.log("Seed complete: demo tenant + owner + PriceRule");
  console.log(`  tenantId=${tenant.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
