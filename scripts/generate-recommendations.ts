import "dotenv/config";
import { generateRecommendationsForTenant } from "../src/lib/recommend/engine";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await generateRecommendationsForTenant({
    limit: Number(process.env.RECOMMEND_LIMIT ?? 20),
    minScore: Number(process.env.RECOMMEND_MIN_SCORE ?? 40),
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
