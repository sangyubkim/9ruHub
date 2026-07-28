import "dotenv/config";
import { buildAnalyticsSnapshot } from "../src/lib/analytics/metrics";

async function main() {
  const snap = await buildAnalyticsSnapshot(undefined, "all");
  console.log(
    JSON.stringify(
      {
        orders: snap.revenue.orderCount,
        revenue: snap.revenue.subtotalKrw,
        period: snap.period,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
