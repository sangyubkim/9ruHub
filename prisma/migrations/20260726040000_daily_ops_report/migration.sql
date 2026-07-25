-- Daily morning ops report
CREATE TABLE IF NOT EXISTS "daily_ops_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "insights" JSONB NOT NULL,
    "narrative" TEXT NOT NULL,
    "usedGpt" BOOLEAN NOT NULL DEFAULT false,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_ops_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_ops_reports_tenantId_reportDate_key"
  ON "daily_ops_reports"("tenantId", "reportDate");

CREATE INDEX IF NOT EXISTS "daily_ops_reports_tenantId_createdAt_idx"
  ON "daily_ops_reports"("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_ops_reports_tenantId_fkey'
  ) THEN
    ALTER TABLE "daily_ops_reports"
      ADD CONSTRAINT "daily_ops_reports_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
