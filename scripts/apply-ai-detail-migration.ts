import "dotenv/config";
import pg from "pg";

/**
 * Additive SQL for ② AI 상세페이지 when `prisma db push` fails on
 * Prisma local postgres (prepared statement / portal errors). Safe to re-run.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();

  await client.query(
    `ALTER TABLE "ProductDraft" ADD COLUMN IF NOT EXISTS "keywords" JSONB`,
  );
  await client.query(
    `ALTER TABLE "ProductDraft" ADD COLUMN IF NOT EXISTS "aiMeta" JSONB`,
  );

  const verify = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'ProductDraft'
       AND column_name IN ('keywords', 'aiMeta')
     ORDER BY column_name`,
  );
  console.log("ai-detail columns:", verify.rows);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
