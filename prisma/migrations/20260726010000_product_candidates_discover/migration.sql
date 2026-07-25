-- CreateEnum
CREATE TYPE "DemandMall" AS ENUM ('NAVER', 'COUPANG');

-- CreateEnum
CREATE TYPE "SupplyMall" AS ENUM ('MALL_1688', 'ALIEXPRESS', 'TAOBAO');

-- CreateTable
CREATE TABLE "product_candidates" (
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
);

-- AlterTable
ALTER TABLE "ai_recommendations" ADD COLUMN "candidateId" TEXT;

-- CreateIndex
CREATE INDEX "product_candidates_tenantId_keyword_idx" ON "product_candidates"("tenantId", "keyword");

-- CreateIndex
CREATE INDEX "product_candidates_tenantId_createdAt_idx" ON "product_candidates"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_candidates_tenant_malls_kw_supply_key" ON "product_candidates"("tenantId", "sourceDemandMall", "sourceSupplyMall", "keyword", "externalSupplyId");

-- CreateIndex
CREATE INDEX "ai_recommendations_candidateId_idx" ON "ai_recommendations"("candidateId");

-- AddForeignKey
ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "product_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
