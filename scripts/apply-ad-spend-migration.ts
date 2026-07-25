import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();

  const exists = await client.query(
    `SELECT to_regclass('public.ad_spends') AS reg`,
  );
  if (!exists.rows[0]?.reg) {
    const sqlPath = path.join(
      process.cwd(),
      "prisma/migrations/20260726050000_ad_spend/migration.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    await client.query(sql);
    console.log("applied ad_spends DDL");
  } else {
    console.log("ad_spends already exists — skip DDL");
  }

  const verify = await client.query(
    `SELECT to_regclass('public.ad_spends') AS reg`,
  );
  console.log("verify:", verify.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
