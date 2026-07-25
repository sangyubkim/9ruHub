import "dotenv/config";
import pg from "pg";

/**
 * Additive SQL: Channel enum에 ELEVENST 추가.
 * `prisma db push` / migrate가 로컬에서 실패할 때 안전 재실행용.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'Channel' AND e.enumlabel = 'ELEVENST'
      ) THEN
        ALTER TYPE "Channel" ADD VALUE 'ELEVENST';
      END IF;
    END $$;
  `);

  const rows = await client.query<{ enumlabel: string }>(
    `SELECT e.enumlabel
     FROM pg_enum e
     JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'Channel'
     ORDER BY e.enumsortorder`,
  );
  console.log(
    "Channel enum:",
    rows.rows.map((r) => r.enumlabel).join(", "),
  );
  await client.end();
  console.log("SQL_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
