import "dotenv/config";
import { parse1688CostFromHtml } from "../src/lib/discover/supply/fetch-1688-offer";
import {
  extract1688OfferId,
  to1688OfferUrl,
} from "../src/lib/discover/supply/parse-1688-url";

async function main() {
  const input = process.argv[2] ?? "https://detail.1688.com/offer/123456789012.html";
  const offerId = extract1688OfferId(input);
  if (!offerId) throw new Error("invalid 1688 url");

  const url = to1688OfferUrl(offerId);
  console.log(JSON.stringify({ offerId, url }, null, 2));

  // 파서 단위 검증
  const sample = parse1688CostFromHtml(
    `<meta property="og:title" content="test offer" /><script>"price":"18.8"</script>`,
  );
  if (sample.costPriceCny !== 18.8) {
    throw new Error(`parser failed: ${sample.costPriceCny}`);
  }

  // 라이브 fetch는 차단될 수 있어 선택적
  if (process.env.SMOKE_1688_LIVE === "1") {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(12000),
    });
    const html = await res.text();
    const parsed = parse1688CostFromHtml(html);
    console.log(
      JSON.stringify(
        {
          httpStatus: res.status,
          costPriceCny: parsed.costPriceCny,
          title: parsed.title?.slice(0, 80) ?? null,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("parser ok (set SMOKE_1688_LIVE=1 to hit remote)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
