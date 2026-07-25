import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

/**
 * Additive SQL for auto-order pipeline when `prisma db push` is flaky.
 * Safe to re-run. Executes the whole file (keeps DO $$ blocks intact).
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();
  const who = await client.query(
    `SELECT current_database() AS db, current_schema() AS schema`,
  );
  console.log("session:", who.rows[0]);

  const sqlPath = path.join(
    process.cwd(),
    "prisma/scripts/auto_order_additive_migrate.sql",
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);

  const verify = await client.query(
    `SELECT to_regclass('public.order_events') AS reg`,
  );
  console.log("verify:", verify.rows[0]);

  const enums = await client.query(
    `SELECT enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'OrderStatus'
     ORDER BY enumsortorder`,
  );
  console.log(
    "OrderStatus:",
    enums.rows.map((r: { enumlabel: string }) => r.enumlabel),
  );

  await client.end();
  console.log("SQL_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
