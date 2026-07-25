import { ConversationRole, Prisma } from "@/generated/prisma/client";
import { geminiChatText } from "@/lib/ai/gemini";
import {
  buildMorningInsights,
  templateMorningNarrative,
  type AdPauseItem,
  type CompetitorPriceDrop,
  type DaySalesSlice,
  type MorningInsight,
  type StockRiskItem,
} from "@/lib/analytics/morning-insights";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

async function salesBetween(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<DaySalesSlice> {
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { notIn: ["CANCELLED"] },
      orderedAt: { gte: from, lt: to },
    },
    select: {
      subtotalKrw: true,
      profitKrw: true,
      refundedKrw: true,
    },
  });
  return {
    orderCount: orders.length,
    revenueKrw: orders.reduce((s, o) => s + o.subtotalKrw, 0),
    profitKrw: orders.reduce((s, o) => s + o.profitKrw, 0),
    refundedKrw: orders.reduce((s, o) => s + o.refundedKrw, 0),
  };
}

async function findCompetitorDrops(
  tenantId: string,
): Promise<CompetitorPriceDrop[]> {
  const products = await prisma.product.findMany({
    where: { tenantId, status: { not: "ARCHIVED" } },
    include: {
      priceHistory: {
        orderBy: { recordedAt: "desc" },
        take: 2,
      },
    },
    take: 50,
  });

  const drops: CompetitorPriceDrop[] = [];
  for (const product of products) {
    const [latest, prev] = product.priceHistory;
    if (!latest?.salePriceKrw || !prev?.salePriceKrw) continue;
    const dropKrw = prev.salePriceKrw - latest.salePriceKrw;
    if (dropKrw >= 500) {
      drops.push({
        productTitle: product.titleKo || product.title,
        dropKrw,
        previousKrw: prev.salePriceKrw,
        currentKrw: latest.salePriceKrw,
      });
    }
  }
  return drops.sort((a, b) => b.dropKrw - a.dropKrw);
}

async function findStockRisks(tenantId: string): Promise<StockRiskItem[]> {
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      status: { in: ["LISTED", "DRAFTING"] },
      OR: [{ inStock: false }, { stockQty: { lte: 3 } }],
    },
    take: 20,
  });

  return products
    .filter((p) => p.totalSold > 0 || !p.inStock || p.stockQty <= 3)
    .map((p) => ({
      productTitle: p.titleKo || p.title,
      stockQty: p.stockQty,
      inStock: p.inStock,
      recentSold: p.totalSold,
    }));
}

async function findAdPauseCandidates(tenantId: string): Promise<AdPauseItem[]> {
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      status: "LISTED",
      totalSold: { gte: 1 },
    },
    take: 50,
  });

  const items: AdPauseItem[] = [];
  for (const p of products) {
    const refundRate = p.totalSold > 0 ? p.refundCount / p.totalSold : 0;
    const title = p.titleKo || p.title;
    if (p.totalProfitKrw < 0) {
      items.push({
        productTitle: title,
        profitKrw: p.totalProfitKrw,
        refundCount: p.refundCount,
        totalSold: p.totalSold,
        reason: "누적 순이익 적자",
      });
    } else if (refundRate >= 0.08) {
      items.push({
        productTitle: title,
        profitKrw: p.totalProfitKrw,
        refundCount: p.refundCount,
        totalSold: p.totalSold,
        reason: `환불률 ${(refundRate * 100).toFixed(1)}%`,
      });
    } else if (p.totalSold >= 5 && p.totalProfitKrw / p.totalSold < 1000) {
      items.push({
        productTitle: title,
        profitKrw: p.totalProfitKrw,
        refundCount: p.refundCount,
        totalSold: p.totalSold,
        reason: "건당 이익 과소",
      });
    }
  }
  return items.slice(0, 5);
}

async function gptNarrative(
  reportDate: string,
  insights: MorningInsight[],
): Promise<string | null> {
  return geminiChatText(
    `당신은 구매대행 운영 비서입니다.
주어진 insights JSON의 message/data만 사용해 매일 아침 브리핑을 한국어로 작성하세요.
새로운 숫자·상품·사실을 만들지 마세요.
형식: 짧은 인사 1줄 + 번호 목록(각 insight.message를 자연스럽게) + 마무리 1줄.`,
    { reportDate, insights },
    0.3,
  );
}

export async function generateMorningReport(options?: {
  tenantId?: string;
  /** 보고서 기준일(보통 오늘). 비교는 어제 vs 그제 */
  asOf?: Date;
  force?: boolean;
}) {
  const tenantId = options?.tenantId ?? (await getDefaultTenantId());
  const asOf = options?.asOf ?? new Date();
  const today = startOfDay(asOf);
  const yesterdayStart = addDays(today, -1);
  const dayBeforeStart = addDays(today, -2);

  if (!options?.force) {
    const existing = await prisma.dailyOpsReport.findUnique({
      where: {
        tenantId_reportDate: { tenantId, reportDate: today },
      },
    });
    if (existing) return { report: existing, created: false };
  }

  const [yesterday, dayBefore, competitorDrops, stockRisks, adPauses] =
    await Promise.all([
      salesBetween(tenantId, yesterdayStart, today),
      salesBetween(tenantId, dayBeforeStart, yesterdayStart),
      findCompetitorDrops(tenantId),
      findStockRisks(tenantId),
      findAdPauseCandidates(tenantId),
    ]);

  const insights = buildMorningInsights({
    yesterday,
    dayBefore,
    competitorDrops,
    stockRisks,
    adPauses,
  });

  const reportDate = dateKey(today);
  const gptText = await gptNarrative(reportDate, insights);
  const narrative =
    gptText ?? templateMorningNarrative(reportDate, insights);

  const conversation = await prisma.aiConversation.create({
    data: {
      tenantId,
      title: `아침 보고서 ${reportDate}`,
      context: toJson({ type: "morning_report", reportDate }),
    },
  });

  await prisma.aiConversationMessage.create({
    data: {
      conversationId: conversation.id,
      role: ConversationRole.ASSISTANT,
      content: narrative,
      metricsSnapshot: toJson({ insights, yesterday, dayBefore }),
    },
  });

  const report = await prisma.dailyOpsReport.upsert({
    where: {
      tenantId_reportDate: { tenantId, reportDate: today },
    },
    create: {
      tenantId,
      reportDate: today,
      insights: toJson(insights),
      narrative,
      usedGpt: Boolean(gptText),
      conversationId: conversation.id,
    },
    update: {
      insights: toJson(insights),
      narrative,
      usedGpt: Boolean(gptText),
      conversationId: conversation.id,
    },
  });

  return { report, created: true, insights };
}

export async function getLatestMorningReport(tenantId?: string) {
  const resolved = tenantId ?? (await getDefaultTenantId());
  return prisma.dailyOpsReport.findFirst({
    where: { tenantId: resolved },
    orderBy: { reportDate: "desc" },
  });
}

export async function listMorningReports(tenantId?: string, take = 14) {
  const resolved = tenantId ?? (await getDefaultTenantId());
  return prisma.dailyOpsReport.findMany({
    where: { tenantId: resolved },
    orderBy: { reportDate: "desc" },
    take,
  });
}
