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

  // Step 1 demo recommendation (rule score + template reason)
  const demoProduct = await prisma.product.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
  });
  if (demoProduct) {
    const existingRec = await prisma.aiRecommendation.findFirst({
      where: { tenantId: tenant.id, productId: demoProduct.id },
    });
    if (!existingRec) {
      await prisma.aiRecommendation.create({
        data: {
          tenantId: tenant.id,
          productId: demoProduct.id,
          draftId: demoProduct.draftId,
          sourceUrl: demoProduct.sourceUrl,
          externalId: demoProduct.externalId,
          title: demoProduct.titleKo ?? demoProduct.title,
          score: 78,
          scoreBreakdown: {
            total: 78,
            reasons: ["시드 샘플", "고마진", "재고 있음"],
          },
          status: "PENDING",
          reasonCode: "STRONG_BUY",
          reasonText:
            "시드 샘플 추천입니다. 규칙 점수 78점으로 마진·재고 조건이 양호합니다.",
          detailHtml:
            "<section><h2>시드 추천 상세</h2><p>데모용 상세 HTML입니다.</p></section>",
        },
      });
    }
  }

  console.log("Seed complete: demo tenant + owner + PriceRule (+ sample rec)");
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
