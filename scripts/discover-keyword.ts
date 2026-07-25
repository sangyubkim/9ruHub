import "dotenv/config";
import { discoverByKeyword } from "../src/lib/discover/engine";
import { prisma } from "../src/lib/db";

async function main() {
  const keyword =
    process.argv.slice(2).join(" ").trim() ||
    process.env.DISCOVER_KEYWORD?.trim() ||
    "무선선풍기";

  const result = await discoverByKeyword(keyword, {
    supplyLimit: Number(process.env.DISCOVER_SUPPLY_LIMIT ?? 3),
    minScore: Number(process.env.DISCOVER_MIN_SCORE ?? 0),
  });

  console.log(
    JSON.stringify(
      {
        keyword: result.keyword,
        created: result.created,
        isStub: result.isStub,
        demandMall: result.demandMall,
        supplyMall: result.supplyMall,
        items: result.items.map((i) => ({
          candidateId: i.candidateId,
          recommendationId: i.recommendationId,
          title: i.title,
          score: i.score,
          label: i.label,
          marginRate: i.metrics.marginRate,
          searchVolume: i.metrics.searchVolume,
          costPriceCny: i.metrics.costPriceCny,
          sellPriceKrw: i.metrics.sellPriceKrw,
          usedGpt: i.usedGpt,
        })),
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
