import "dotenv/config";
import { discoverByKeyword } from "../src/lib/discover/engine";
import { scoreDiscoverCandidate } from "../src/lib/discover/score";
import { prisma } from "../src/lib/db";

async function main() {
  const fixed = scoreDiscoverCandidate({
    searchVolume: 25000,
    competition: 0.2,
    marginRate: 0.42,
    rating: 4.6,
    reviewCount: 6000,
    seasonalityScore: 80,
  });
  if (fixed.total < 75 || fixed.label !== "STRONG_BUY") {
    throw new Error(`score sanity failed: ${fixed.total} ${fixed.label}`);
  }

  const result = await discoverByKeyword("무선선풍기", {
    supplyLimit: 2,
    minScore: 0,
  });

  if (result.created < 1) {
    throw new Error("discover created 0 items");
  }
  if (!result.isStub) {
    throw new Error("expected stub adapters in smoke");
  }

  const candidate = await prisma.productCandidate.findFirst({
    where: { keyword: "무선선풍기", tenantId: result.tenantId },
  });
  if (!candidate) throw new Error("candidate not persisted");

  const rec = await prisma.aiRecommendation.findFirst({
    where: { candidateId: candidate.id, tenantId: result.tenantId },
  });
  if (!rec) throw new Error("recommendation not linked");

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: result.created,
        score: result.items[0]?.score,
        label: result.items[0]?.label,
        candidateId: candidate.id,
        recommendationId: rec.id,
        isStub: candidate.isStub,
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
