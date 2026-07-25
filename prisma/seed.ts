import "dotenv/config";
import { MemberRole } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/prisma-pg";

const prisma = createPrismaClient();

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

  // ① AI 상품 발굴 — Naver ↔ 1688 demo candidates (no live crawl)
  const demoCandidates = [
    {
      keyword: "무선선풍기",
      title: "무선선풍기 · 도매 오퍼 #1",
      externalSupplyId: "seed-1688-fan-1",
      searchVolume: 24500,
      competition: 0.28,
      reviewCount: 6200,
      rating: 4.5,
      salesEstimate: 980,
      costPrice: 32.5,
      sellPrice: 42900,
      marginRate: 0.38,
      seasonalityScore: 72,
      score: 82,
      label: "STRONG_BUY",
    },
    {
      keyword: "캠핑랜턴",
      title: "캠핑랜턴 · 도매 오퍼 #1",
      externalSupplyId: "seed-1688-lantern-1",
      searchVolume: 11200,
      competition: 0.41,
      reviewCount: 2100,
      rating: 4.2,
      salesEstimate: 420,
      costPrice: 18.8,
      sellPrice: 25900,
      marginRate: 0.33,
      seasonalityScore: 58,
      score: 68,
      label: "BUY",
    },
    {
      keyword: "주방수납선반",
      title: "주방수납선반 · 도매 오퍼 #1",
      externalSupplyId: "seed-1688-shelf-1",
      searchVolume: 3800,
      competition: 0.55,
      reviewCount: 890,
      rating: 3.9,
      salesEstimate: 140,
      costPrice: 45.0,
      sellPrice: 49900,
      marginRate: 0.24,
      seasonalityScore: 44,
      score: 48,
      label: "WATCH",
    },
  ] as const;

  for (const demo of demoCandidates) {
    const candidate = await prisma.productCandidate.upsert({
      where: {
        tenantId_sourceDemandMall_sourceSupplyMall_keyword_externalSupplyId: {
          tenantId: tenant.id,
          sourceDemandMall: "NAVER",
          sourceSupplyMall: "MALL_1688",
          keyword: demo.keyword,
          externalSupplyId: demo.externalSupplyId,
        },
      },
      create: {
        tenantId: tenant.id,
        sourceDemandMall: "NAVER",
        sourceSupplyMall: "MALL_1688",
        keyword: demo.keyword,
        title: demo.title,
        demandUrl: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(demo.keyword)}`,
        supplyUrl: `https://detail.1688.com/offer/${demo.externalSupplyId}.html`,
        externalDemandId: `seed-naver-${demo.keyword}`,
        externalSupplyId: demo.externalSupplyId,
        searchVolume: demo.searchVolume,
        competition: demo.competition,
        reviewCount: demo.reviewCount,
        rating: demo.rating,
        salesEstimate: demo.salesEstimate,
        costPrice: demo.costPrice,
        sellPrice: demo.sellPrice,
        marginRate: demo.marginRate,
        seasonalityScore: demo.seasonalityScore,
        currency: "CNY",
        isStub: true,
        rawMetrics: { seed: true, pair: "NAVER↔1688" },
      },
      update: {
        title: demo.title,
        searchVolume: demo.searchVolume,
        competition: demo.competition,
        reviewCount: demo.reviewCount,
        rating: demo.rating,
        salesEstimate: demo.salesEstimate,
        costPrice: demo.costPrice,
        sellPrice: demo.sellPrice,
        marginRate: demo.marginRate,
        seasonalityScore: demo.seasonalityScore,
        isStub: true,
      },
    });

    const existingCandRec = await prisma.aiRecommendation.findFirst({
      where: { tenantId: tenant.id, candidateId: candidate.id },
    });
    if (!existingCandRec) {
      await prisma.aiRecommendation.create({
        data: {
          tenantId: tenant.id,
          candidateId: candidate.id,
          sourceUrl: candidate.supplyUrl,
          externalId: candidate.externalSupplyId,
          title: candidate.title,
          score: demo.score,
          scoreBreakdown: {
            total: demo.score,
            label: demo.label,
            reasons: ["시드 발굴 샘플", "네이버↔1688"],
            features: {
              searchVolume: demo.searchVolume,
              competition: demo.competition,
              marginRate: demo.marginRate,
              rating: demo.rating,
              reviewCount: demo.reviewCount,
              seasonalityScore: demo.seasonalityScore,
              costPriceCny: demo.costPrice,
              sellPriceKrw: demo.sellPrice,
            },
          },
          status: "PENDING",
          reasonCode: demo.label,
          reasonText: `시드 발굴 샘플입니다. 규칙 점수 ${demo.score}점(${demo.label}). 네이버 검색량 ${demo.searchVolume.toLocaleString("ko-KR")}, 예상 마진 ${(demo.marginRate * 100).toFixed(0)}%.`,
          detailHtml: `<section><h2>시드 발굴 상세</h2><p>${demo.keyword} 데모 후보입니다.</p></section>`,
        },
      });
    }
  }

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
    "Seed complete: demo tenant + owner + PriceRule (+ discover candidates/rec/order/shipment/conversation)",
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
