import "dotenv/config";
import { syncAllLiveDrafts } from "../src/lib/sync/scheduler";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const result = await syncAllLiveDrafts({ limit });
  console.log(JSON.stringify(result, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
