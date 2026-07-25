import "dotenv/config";
import pg from "pg";

/**
 * Additive SQL apply for ① discover MVP when `prisma db push` fails on
 * Prisma local postgres (portal/08P01). Safe to re-run (IF NOT EXISTS / DO blocks).
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();
  const who = await client.query(`SELECT current_database() AS db`);
  console.log("session:", who.rows[0]);

  const exists = await client.query(
    `SELECT to_regclass('public.product_candidates') AS reg`,
  );
  if (exists.rows[0]?.reg) {
    console.log("product_candidates already exists — skip");
    await client.end();
    return;
  }

  const statements = [
    `DO $$ BEGIN CREATE TYPE "DemandMall" AS ENUM ('NAVER', 'COUPANG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "SupplyMall" AS ENUM ('MALL_1688', 'ALIEXPRESS', 'TAOBAO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "product_candidates" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "sourceDemandMall" "DemandMall" NOT NULL DEFAULT 'NAVER',
      "sourceSupplyMall" "SupplyMall" NOT NULL DEFAULT 'MALL_1688',
      "keyword" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "demandUrl" TEXT,
      "supplyUrl" TEXT,
      "externalDemandId" TEXT,
      "externalSupplyId" TEXT,
      "searchVolume" INTEGER,
      "competition" DECIMAL(8,4),
      "reviewCount" INTEGER,
      "rating" DECIMAL(4,2),
      "salesEstimate" INTEGER,
      "costPrice" DECIMAL(12,2),
      "sellPrice" INTEGER,
      "marginRate" DECIMAL(8,4),
      "seasonalityScore" DECIMAL(8,4),
      "currency" TEXT NOT NULL DEFAULT 'CNY',
      "isStub" BOOLEAN NOT NULL DEFAULT true,
      "rawMetrics" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "product_candidates_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "ai_recommendations" ADD COLUMN IF NOT EXISTS "candidateId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "product_candidates_tenantId_keyword_idx" ON "product_candidates"("tenantId", "keyword")`,
    `CREATE INDEX IF NOT EXISTS "product_candidates_tenantId_createdAt_idx" ON "product_candidates"("tenantId", "createdAt")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "product_candidates_tenant_malls_kw_supply_key" ON "product_candidates"("tenantId", "sourceDemandMall", "sourceSupplyMall", "keyword", "externalSupplyId")`,
    `CREATE INDEX IF NOT EXISTS "ai_recommendations_candidateId_idx" ON "ai_recommendations"("candidateId")`,
    `DO $$ BEGIN
      ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_candidateId_fkey"
        FOREIGN KEY ("candidateId") REFERENCES "product_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const [i, sql] of statements.entries()) {
    await client.query(sql);
    console.log(`ok #${i + 1}`);
  }

  const verify = await client.query(
    `SELECT to_regclass('public.product_candidates') AS reg`,
  );
  console.log("verify:", verify.rows[0]);
  await client.end();
  console.log("SQL_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
