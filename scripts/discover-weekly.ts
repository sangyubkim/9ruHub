import "dotenv/config";
import { runWeeklyDiscover } from "../src/lib/discover/weekly-scan";
import type { DiscoverSeedCategory } from "../src/lib/discover/seed-keywords";

async function main() {
  const category = (process.argv[2] ?? "seasonal_home") as
    | DiscoverSeedCategory
    | "all";
  const expand = process.argv.includes("--expand");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const seedLimit = limitArg
    ? Number(limitArg.replace("--limit=", ""))
    : category === "all"
      ? 8
      : undefined;

  const result = await runWeeklyDiscover({
    category,
    expandRelated: expand,
    seedLimit: Number.isFinite(seedLimit) ? seedLimit : undefined,
    supplyMode: "demand_only",
    minScore: 40,
    delayMs: 200,
  });

  console.log(
    JSON.stringify(
      {
        category: result.category,
        supplyMode: result.supplyMode,
        scanned: result.scanned,
        seedCount: result.seedCount,
        relatedCount: result.relatedCount,
        createdTotal: result.createdTotal,
        addedCount: result.addedCount,
        noHitCount: result.noHitCount,
        failedCount: result.failedCount,
        awaitingAmazonCount: result.awaitingAmazonCount,
        stubCount: result.stubCount,
        addedKeywords: result.added.map((r) => r.keyword),
        top: result.top.slice(0, 8),
        errors: result.results.filter((r) => r.error).slice(0, 5),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
