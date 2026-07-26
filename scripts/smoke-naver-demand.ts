import "dotenv/config";
import { NaverDemandLiveAdapter } from "../src/lib/discover/demand/naver-live";

async function main() {
  const keyword = process.argv[2] ?? "무선선풍기";
  const adapter = new NaverDemandLiveAdapter();
  const m = await adapter.fetchDemand(keyword);
  const raw = (m.raw ?? {}) as Record<string, unknown>;
  console.log(
    JSON.stringify(
      {
        keyword: m.keyword,
        isStub: m.isStub,
        searchVolume: m.searchVolume,
        competition: m.competition,
        title: m.title.slice(0, 60),
        volumeSource: raw.volumeSource ?? null,
        shopTotal: raw.shopTotal ?? null,
        matchedKeyword: raw.matchedKeyword ?? null,
        searchAdError: raw.searchAdError ?? null,
        liveError: raw.liveError ?? null,
      },
      null,
      2,
    ),
  );
  if (m.isStub) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
