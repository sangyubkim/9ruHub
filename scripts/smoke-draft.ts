import "dotenv/config";
import { createDraftFromUrl } from "../src/lib/draft/create-from-url";

async function main() {
  const draft = await createDraftFromUrl("B0D1XD1ZV3");
  console.log(
    JSON.stringify(
      {
        id: draft.id,
        title: draft.titleKo,
        price: draft.salePriceKrw,
        fallback: draft.isFallbackData,
        listings: draft.listings.map((l) => l.channel),
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
