import "dotenv/config";
import { generateMorningReport } from "../src/lib/analytics/morning-report";

async function main() {
  const result = await generateMorningReport({ force: true });
  console.log(
    JSON.stringify(
      {
        id: result.report.id,
        usedGpt: result.report.usedGpt,
        narrativePreview: result.report.narrative.slice(0, 400),
        insightCount: Array.isArray(result.insights)
          ? result.insights.length
          : 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
