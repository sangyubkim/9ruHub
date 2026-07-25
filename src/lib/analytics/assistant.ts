import { ConversationRole, Prisma } from "@/generated/prisma/client";
import {
  buildAnalyticsSnapshot,
  type AnalyticsSnapshot,
} from "@/lib/analytics/metrics";
import { prisma } from "@/lib/db";
import { getDefaultTenantId } from "@/lib/tenant";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const SYSTEM_PROMPT = `당신은 구매대행 운영 비서입니다.
아래 metrics JSON에 있는 숫자만 사용해 한국어로 설명하세요.
JSON에 없는 매출/이익/건수를 추측하거나 만들지 마세요.
없으면 "데이터 없음"이라고 말하세요.`;

function templateExplain(snapshot: AnalyticsSnapshot, question: string): string {
  const r = snapshot.revenue;
  const rec = snapshot.recommendations;
  const top = snapshot.topProducts[0];
  return [
    `질문: ${question}`,
    `DB 스냅샷(${snapshot.generatedAt}) 기준:`,
    `- 주문 ${r.orderCount}건, 매출 ${r.subtotalKrw.toLocaleString("ko-KR")}원, 이익 ${r.profitKrw.toLocaleString("ko-KR")}원, 마진율 ${(r.marginRate * 100).toFixed(1)}%`,
    `- 환불액 ${r.refundedKrw.toLocaleString("ko-KR")}원`,
    top
      ? `- 매출 1위: ${top.title} (${top.revenueKrw.toLocaleString("ko-KR")}원 / ${top.quantity}개)`
      : "- 매출 1위 상품 데이터 없음",
    `- 추천 ${rec.total}건(대기 ${rec.pending}, 수락/초안 ${rec.acceptedOrDrafted}, 무시 ${rec.ignored}), 평균점수 ${rec.avgScore.toFixed(1)}, 전환율 ${(rec.conversionRate * 100).toFixed(1)}%`,
  ].join("\n");
}

async function gptExplain(
  snapshot: AnalyticsSnapshot,
  question: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ question, metrics: snapshot }),
        },
      ],
    }),
  });
  if (!res.ok) {
    console.warn("ops assistant GPT failed", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function askOpsAssistant(options: {
  question: string;
  tenantId?: string;
  conversationId?: string;
}) {
  const tenantId = options.tenantId ?? (await getDefaultTenantId());
  const snapshot = await buildAnalyticsSnapshot(tenantId);

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
