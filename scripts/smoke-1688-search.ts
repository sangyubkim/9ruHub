import "dotenv/config";
import { create1688SupplyAdapter } from "../src/lib/discover/supply/mall1688-live";
import { search1688Offers } from "../src/lib/discover/supply/search-1688";

async function main() {
  const keyword = process.argv[2]?.trim() || "无线风扇";
  const mode = process.env.DISCOVER_1688_MODE ?? "auto";

  console.log(`1688 search smoke: keyword="${keyword}" mode=${mode}`);

  const direct = await search1688Offers(keyword, {
    limit: 3,
    enrichLimit: 2,
  });
  console.log(
    JSON.stringify(
      {
        searchUrl: direct.searchUrl,
        hitCount: direct.hitCount,
        enriched: direct.enriched,
        fetchError: direct.fetchError ?? null,
        offers: direct.offers.map((o) => ({
          id: o.externalSupplyId,
          title: o.title.slice(0, 60),
          costPriceCny: o.costPriceCny,
          isStub: o.isStub,
          weightGrams: o.weightGrams ?? null,
        })),
      },
      null,
      2,
    ),
  );

  const adapter = create1688SupplyAdapter();
  const viaAdapter = await adapter.fetchSupplyOffers(keyword, 2);
  console.log(
    JSON.stringify(
      {
        adapter: adapter.name,
        count: viaAdapter.length,
        sample: viaAdapter[0]
          ? {
              id: viaAdapter[0].externalSupplyId,
              title: viaAdapter[0].title.slice(0, 60),
              costPriceCny: viaAdapter[0].costPriceCny,
              isStub: viaAdapter[0].isStub,
              liveFallback: Boolean(
                (viaAdapter[0].raw as { liveFallback?: boolean } | undefined)
                  ?.liveFallback,
              ),
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (viaAdapter.length < 1) {
    throw new Error("adapter returned 0 offers (unexpected for auto/stub)");
  }

  console.log("smoke:1688-search ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
