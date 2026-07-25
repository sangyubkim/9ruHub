-- CreateTable: daily ad spend for analytics ROI
CREATE TABLE IF NOT EXISTS "ad_spends" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "channel" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_spends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ad_spends_tenantId_date_idx" ON "ad_spends"("tenantId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_spends_tenantId_fkey'
  ) THEN
    ALTER TABLE "ad_spends"
      ADD CONSTRAINT "ad_spends_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
