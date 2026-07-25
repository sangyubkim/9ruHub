import "dotenv/config";
import { generateAiDetail } from "../src/lib/ai-detail/generate";
import { previewAiDetailFromUrl } from "../src/lib/ai-detail/service";

async function main() {
  const asin = process.argv[2] ?? "B0D1XD1ZV3";
  console.log("=== AI detail smoke ===");
  console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "set" : "missing (template fallback)");

  const unit = await generateAiDetail({
    title: "Smoke Test Bottle",
    brand: "SmokeBrand",
    sourceUrl: `https://www.amazon.com/dp/${asin}`,
    asin,
    sourcePriceUsd: 19.99,
    salePriceKrw: 45000,
    inStock: true,
    options: [{ name: "Color", values: ["Black"] }],
    sourceLang: "en",
  });
  console.log(
    JSON.stringify(
      {
        mode: "unit",
        usedGpt: unit.usedGpt,
        titleKo: unit.titleKo,
        keywords: unit.keywords.slice(0, 5),
        optionNames: unit.options.map((o) => o.name),
        htmlLength: unit.detailHtml.length,
      },
      null,
      2,
    ),
  );

  const preview = await previewAiDetailFromUrl(asin);
  console.log(
    JSON.stringify(
      {
        mode: "preview-from-url",
        usedGpt: preview.usedGpt,
        titleKo: preview.titleKo,
        salePriceKrw: preview.product.salePriceKrw,
        fallback: preview.product.isFallbackData,
        keywords: preview.keywords.slice(0, 5),
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
