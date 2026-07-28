import "dotenv/config";
import pg from "pg";

async function check(url: string, label: string) {
  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();
  const db = await client.query("SELECT current_database() AS db");
  const enums = await client.query(
    `SELECT enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'OrderStatus'
     ORDER BY enumsortorder`,
  );
  const used = await client.query(
    `SELECT DISTINCT status::text AS status FROM orders`,
  );
  console.log("---", label, db.rows[0].db);
  console.log(
    "OrderStatus:",
    enums.rows.map((r: { enumlabel: string }) => r.enumlabel),
  );
  console.log(
    "used:",
    used.rows.map((r: { status: string }) => r.status),
  );
  await client.end();
}

async function main() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL missing");
  console.log("DATABASE_URL db=", base.match(/\/([^/?]+)(\?|$)/)?.[1]);
  await check(base, "env");
  const hub = base.replace(/\/[^/?]+(\?|$)/, "/sourcing_hub$1");
  const tmpl = base.replace(/\/[^/?]+(\?|$)/, "/template1$1");
  if (hub !== base) await check(hub, "sourcing_hub");
  if (tmpl !== base) await check(tmpl, "template1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
