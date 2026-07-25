import "dotenv/config";
import { askOpsAssistant } from "../src/lib/analytics/assistant";
import { buildAnalyticsSnapshot } from "../src/lib/analytics/metrics";
import { prisma } from "../src/lib/db";

async function main() {
  const snapshot = await buildAnalyticsSnapshot();
  const answer = await askOpsAssistant({
    question: "매출·마진·추천 성과를 한 줄로 요약해줘",
  });
  console.log(
    JSON.stringify(
      {
        orderCount: snapshot.revenue.orderCount,
        profitKrw: snapshot.revenue.profitKrw,
        conversationId: answer.conversationId,
        answerPreview: answer.answer.slice(0, 160),
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
