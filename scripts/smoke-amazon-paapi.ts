/**
 * Amazon PA-API GetItems 스모크.
 * .env 에 AMAZON_PAAPI_* 필요.
 *
 *   npx tsx scripts/smoke-amazon-paapi.ts B0CQXG17RL
 */
import "dotenv/config";
import { hasAmazonPaapiCredentials } from "../src/lib/amazon/paapi/config";
import { fetchAmazonUsProduct } from "../src/lib/amazon/fetch-product";

async function main() {
  const asin = process.argv[2] ?? "B0CQXG17RL";
  if (!hasAmazonPaapiCredentials()) {
    console.error(
      "AMAZON_PAAPI_ACCESS_KEY / SECRET_KEY / PARTNER_TAG 가 .env 에 없습니다.",
    );
    console.error(
      "Associates Central → Tools → Product Advertising API 에서 키를 발급하세요.",
    );
    process.exit(1);
  }

  const product = await fetchAmazonUsProduct(asin);
  console.log(
    JSON.stringify(
      {
        isFallback: product.isFallback,
        source: product.raw?.source ?? product.raw?.reason,
        asin: product.asin,
        title: product.title,
        brand: product.brand,
        sourcePrice: product.sourcePrice,
        currency: product.currency,
        weightGrams: product.weightGrams,
        images: product.images.length,
      },
      null,
      2,
    ),
  );
  if (product.isFallback) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
