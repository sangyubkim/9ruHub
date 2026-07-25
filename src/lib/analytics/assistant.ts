import { ConversationRole, Prisma } from "@/generated/prisma/client";
import { geminiChatText } from "@/lib/ai/gemini";
import {
  buildAnalyticsSnapshot,
  parseAnalyticsPeriod,
  type AnalyticsPeriod,
  type AnalyticsSnapshot,
} from "@/lib/analytics/metrics";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const SYSTEM_PROMPT = `당신은 구매대행 운영 비서입니다.
아래 metrics JSON에 있는 숫자만 사용해 한국어로 설명하세요.
JSON에 없는 매출/이익/건수/광고비/ROI/환불률을 추측하거나 만들지 마세요.
없으면 "데이터 없음"이라고 말하세요.
공식: ROI = 순이익/광고비(비율, %로 말할 때 ×100), 환불률 = 환불주문수/판매건수.`;

function templateExplain(snapshot: AnalyticsSnapshot, question: string): string {
  const r = snapshot.revenue;
  const rec = snapshot.recommendations;
  const top = snapshot.topProducts[0];
  return [
    `질문: ${question}`,
    `DB 스냅샷(${snapshot.generatedAt}, period=${snapshot.period}) 기준:`,
    `- 판매 ${r.orderCount}건, 매출 ${r.subtotalKrw.toLocaleString("ko-KR")}원, 순이익 ${r.profitKrw.toLocaleString("ko-KR")}원, 마진율 ${(r.marginRate * 100).toFixed(1)}%`,
    `- 광고비 ${r.adSpendKrw.toLocaleString("ko-KR")}원, ROI ${(r.roi * 100).toFixed(1)}% (순이익÷광고비)`,
    `- 환불률 ${(r.refundRate * 100).toFixed(1)}% (${r.refundedOrderCount}/${r.orderCount}건), 환불액 ${r.refundedKrw.toLocaleString("ko-KR")}원`,
    top
      ? `- 매출 1위: ${top.title} (${top.revenueKrw.toLocaleString("ko-KR")}원 / ${top.quantity}개)`
      : "- 매출 1위 상품 데이터 없음",
    `- 추천 ${rec.total}건(대기 ${rec.pending}, 수락/초안 ${rec.acceptedOrDrafted}, 무시 ${rec.ignored}), 평균점수 ${rec.avgScore.toFixed(1)}, 전환율 ${(rec.conversionRate * 100).toFixed(1)}%`,
    `- 물류: 미완료 ${snapshot.logistics.openShipments}건, 배송완료 ${snapshot.logistics.deliveredShipments}건`,
  ].join("\n");
}

async function gptExplain(
  snapshot: AnalyticsSnapshot,
  question: string,
): Promise<string | null> {
  return geminiChatText(SYSTEM_PROMPT, { question, metrics: snapshot }, 0.2);
}

export async function askOpsAssistant(options: {
  question: string;
  tenantId?: string;
  conversationId?: string;
  period?: AnalyticsPeriod | string;
}) {
  const tenantId = options.tenantId ?? (await getDefaultTenantId());
  const period = parseAnalyticsPeriod(options.period);
  const snapshot = await buildAnalyticsSnapshot(tenantId, period);

  let conversationId = options.conversationId;
  if (!conversationId) {
    const created = await prisma.aiConversation.create({
      data: {
        tenantId,
        title: options.question.slice(0, 80),
        context: toJson({ lastSnapshotAt: snapshot.generatedAt }),
      },
    });
    conversationId = created.id;
  }

  await prisma.aiConversationMessage.create({
    data: {
      conversationId,
      role: ConversationRole.USER,
      content: options.question,
      metricsSnapshot: toJson(snapshot),
    },
  });

  const gptAnswer = await gptExplain(snapshot, options.question);
  const answer = gptAnswer ?? templateExplain(snapshot, options.question);

  await prisma.aiConversationMessage.create({
    data: {
      conversationId,
      role: ConversationRole.ASSISTANT,
      content: answer,
      metricsSnapshot: toJson(snapshot),
    },
  });

  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: {
      context: toJson({ lastSnapshotAt: snapshot.generatedAt }),
      updatedAt: new Date(),
    },
  });

  return {
    conversationId,
    answer,
    snapshot,
    usedGpt: Boolean(gptAnswer),
  };
}

export async function listConversations(tenantId?: string) {
  const resolvedTenantId = tenantId ?? (await getDefaultTenantId());
  return prisma.aiConversation.findMany({
    where: { tenantId: resolvedTenantId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
    },
    take: 20,
  });
}
