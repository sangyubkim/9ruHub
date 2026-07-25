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

  // Step 2 sample order linked to product when available
  const existingOrder = await prisma.order.findFirst({
    where: { tenantId: tenant.id, externalOrderId: "SEED-ORDER-001" },
  });
  if (!existingOrder) {
    const product = await prisma.product.findFirst({
      where: { tenantId: tenant.id },
    });
    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        channel: "SMARTSTORE",
        externalOrderId: "SEED-ORDER-001",
        status: "PENDING",
        customerName: "시드고객",
        subtotalKrw: product?.salePriceKrw ?? 59000,
        shippingFeeKrw: 0,
        platformFeeKrw: 3000,
        costKrw: product?.costKrw ?? 32000,
        profitKrw:
          (product?.salePriceKrw ?? 59000) -
          (product?.costKrw ?? 32000) -
          3000,
        items: {
          create: [
            {
              productId: product?.id,
              title: product?.titleKo ?? product?.title ?? "시드 상품",
              quantity: 1,
              unitSalePriceKrw: product?.salePriceKrw ?? 59000,
              unitCostKrw: product?.costKrw ?? 32000,
              lineProfitKrw:
                (product?.salePriceKrw ?? 59000) - (product?.costKrw ?? 32000),
              sourceUrl: product?.sourceUrl,
              purchaseStatus: "STUBBED",
            },
          ],
        },
      },
    });
  }

  // Step 3 sample shipment for seed order if missing
  const seedOrder = await prisma.order.findFirst({
    where: { tenantId: tenant.id, externalOrderId: "SEED-ORDER-001" },
    include: { shipment: true },
  });
  if (seedOrder && !seedOrder.shipment) {
    await prisma.shipment.create({
      data: {
        tenantId: tenant.id,
        orderId: seedOrder.id,
        status: "AT_FORWARDER",
        forwarderCode: "stub-forwarder",
        forwarderTrackingNo: `FWD-SEED-${Date.now()}`,
        shippingCostKrw: 8000,
        events: [
          {
            at: new Date().toISOString(),
            description: "시드 배대지 입고",
          },
        ],
      },
    });
  }

  // Step 4 sample ops conversation with metrics snapshot
  const existingConv = await prisma.aiConversation.findFirst({
    where: { tenantId: tenant.id, title: "시드 운영 브리핑" },
  });
  if (!existingConv) {
    const conv = await prisma.aiConversation.create({
      data: {
        tenantId: tenant.id,
        title: "시드 운영 브리핑",
        context: {
          note: "seed",
          capturedAt: new Date().toISOString(),
        },
      },
    });
    await prisma.aiConversationMessage.createMany({
      data: [
        {
          conversationId: conv.id,
          role: "USER",
          content: "수익과 마진 요약해줘",
          metricsSnapshot: { seed: true },
        },
        {
          conversationId: conv.id,
          role: "ASSISTANT",
          content:
            "시드 대화입니다. 대시보드와 /analytics에서 실시간 DB 집계 수치를 확인하세요.",
          metricsSnapshot: { seed: true, usedGpt: false },
        },
      ],
    });
  }

  console.log(
    "Seed complete: demo tenant + owner + PriceRule (+ sample rec/order/shipment/conversation)",
  );
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
