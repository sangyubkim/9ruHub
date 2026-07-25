import "dotenv/config";
import { askOpsAssistant } from "../src/lib/analytics/assistant";
import { buildAnalyticsSnapshot } from "../src/lib/analytics/metrics";
import { prisma } from "../src/lib/db";

async function main() {
  const snapshot = await buildAnalyticsSnapshot(undefined, "today");
  const r = snapshot.revenue;
  const required = [
    "orderCount",
    "subtotalKrw",
    "profitKrw",
    "adSpendKrw",
    "roi",
    "refundRate",
  ] as const;
  for (const key of required) {
    if (typeof r[key] !== "number") {
      throw new Error(`missing revenue.${key}`);
    }
  }

  const answer = await askOpsAssistant({
    question: "오늘 판매·매출·순이익·광고비·ROI·환불률 한 줄 요약",
    period: "today",
  });

  console.log(
    JSON.stringify(
      {
        period: snapshot.period,
        orderCount: r.orderCount,
        subtotalKrw: r.subtotalKrw,
        profitKrw: r.profitKrw,
        adSpendKrw: r.adSpendKrw,
        roiPct: Number((r.roi * 100).toFixed(1)),
        refundRatePct: Number((r.refundRate * 100).toFixed(1)),
        conversationId: answer.conversationId,
        answerPreview: answer.answer.slice(0, 200),
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
