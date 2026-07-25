-- Step 0 additive migrate: keep existing draft rows, add SaaS tables + tenantId

-- Enums (idempotent-ish)
DO $$ BEGIN CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductStatus" AS ENUM ('SOURCING', 'DRAFTING', 'LISTED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IGNORED', 'DRAFT_CREATED', 'CONVERTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PURCHASE_REQUESTED', 'PURCHASED', 'SHIPPED_TO_FORWARDER', 'IN_FORWARDER', 'SHIPPED_TO_CUSTOMER', 'DELIVERED', 'CANCELLED', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PurchaseAttemptStatus" AS ENUM ('STUBBED', 'QUEUED', 'SUCCEEDED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'AT_FORWARDER', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceRegisterStatus" AS ENUM ('NOT_REQUESTED', 'STUBBED', 'SUCCEEDED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ConversationRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE TABLE IF NOT EXISTS "tenant_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "tenant_members_userId_idx" ON "tenant_members"("userId");

-- Demo tenant + user
INSERT INTO "tenants" ("id", "slug", "name", "createdAt", "updatedAt")
VALUES ('demo_tenant_step0', 'demo', 'Demo Tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "users" ("id", "email", "name", "createdAt", "updatedAt")
VALUES ('demo_user_step0', 'demo@sourcing-hub.local', 'Demo Owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "tenant_members" ("id", "tenantId", "userId", "role", "createdAt")
SELECT 'demo_member_step0', t."id", u."id", 'OWNER', CURRENT_TIMESTAMP
FROM "tenants" t, "users" u
WHERE t."slug" = 'demo' AND u."email" = 'demo@sourcing-hub.local'
ON CONFLICT DO NOTHING;

-- Add tenantId columns if missing
ALTER TABLE "PriceRule" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "SourceProduct" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ProductDraft" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

UPDATE "PriceRule" SET "tenantId" = (SELECT "id" FROM "tenants" WHERE "slug" = 'demo') WHERE "tenantId" IS NULL;
UPDATE "SourceProduct" SET "tenantId" = (SELECT "id" FROM "tenants" WHERE "slug" = 'demo') WHERE "tenantId" IS NULL;
UPDATE "ProductDraft" SET "tenantId" = (SELECT "id" FROM "tenants" WHERE "slug" = 'demo') WHERE "tenantId" IS NULL;

ALTER TABLE "PriceRule" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SourceProduct" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ProductDraft" ALTER COLUMN "tenantId" SET NOT NULL;

-- Replace uniqueness for PriceRule / SourceProduct
ALTER TABLE "PriceRule" DROP CONSTRAINT IF EXISTS "PriceRule_name_key";
DROP INDEX IF EXISTS "PriceRule_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PriceRule_tenantId_name_key" ON "PriceRule"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "PriceRule_tenantId_idx" ON "PriceRule"("tenantId");

ALTER TABLE "SourceProduct" DROP CONSTRAINT IF EXISTS "SourceProduct_mall_externalId_key";
DROP INDEX IF EXISTS "SourceProduct_mall_externalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SourceProduct_tenantId_mall_externalId_key" ON "SourceProduct"("tenantId", "mall", "externalId");
CREATE INDEX IF NOT EXISTS "SourceProduct_tenantId_createdAt_idx" ON "SourceProduct"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProductDraft_tenantId_status_idx" ON "ProductDraft"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ProductDraft_tenantId_createdAt_idx" ON "ProductDraft"("tenantId", "createdAt");

-- FKs for tenantId (ignore if exists)
DO $$ BEGIN
  ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SourceProduct" ADD CONSTRAINT "SourceProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductDraft" ADD CONSTRAINT "ProductDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New SaaS tables
CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceProductId" TEXT,
    "draftId" TEXT,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "titleKo" TEXT,
    "brand" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'SOURCING',
    "sourceMall" "SourceMall" NOT NULL DEFAULT 'AMAZON_US',
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sourcePrice" DECIMAL(12,2) NOT NULL,
    "salePriceKrw" INTEGER,
    "costKrw" INTEGER,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "images" JSONB,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "totalRevenueKrw" INTEGER NOT NULL DEFAULT 0,
    "totalProfitKrw" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_sourceMall_externalId_key" ON "products"("tenantId", "sourceMall", "externalId");
CREATE INDEX IF NOT EXISTS "products_tenantId_status_idx" ON "products"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "products_tenantId_updatedAt_idx" ON "products"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "products_tenantId_createdAt_idx" ON "products"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "product_price_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourcePrice" DECIMAL(12,2) NOT NULL,
    "salePriceKrw" INTEGER,
    "costKrw" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "inStock" BOOLEAN,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "product_price_history_tenantId_recordedAt_idx" ON "product_price_history"("tenantId", "recordedAt");
CREATE INDEX IF NOT EXISTS "product_price_history_productId_recordedAt_idx" ON "product_price_history"("productId", "recordedAt");

CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "Channel",
    "externalOrderId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "shippingAddress" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "subtotalKrw" INTEGER NOT NULL DEFAULT 0,
    "shippingFeeKrw" INTEGER NOT NULL DEFAULT 0,
    "platformFeeKrw" INTEGER NOT NULL DEFAULT 0,
    "costKrw" INTEGER NOT NULL DEFAULT 0,
    "profitKrw" INTEGER NOT NULL DEFAULT 0,
    "refundedKrw" INTEGER NOT NULL DEFAULT 0,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenantId_channel_externalOrderId_key" ON "orders"("tenantId", "channel", "externalOrderId");
CREATE INDEX IF NOT EXISTS "orders_tenantId_status_idx" ON "orders"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "orders_tenantId_orderedAt_idx" ON "orders"("tenantId", "orderedAt");

CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitSalePriceKrw" INTEGER NOT NULL,
    "unitCostKrw" INTEGER NOT NULL DEFAULT 0,
    "lineProfitKrw" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,
    "purchaseMall" TEXT,
    "purchaseStatus" "PurchaseAttemptStatus" NOT NULL DEFAULT 'STUBBED',
    "purchaseRef" TEXT,
    "purchasePayload" JSONB,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_productId_idx" ON "order_items"("productId");

CREATE TABLE IF NOT EXISTS "shipments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "forwarderCode" TEXT,
    "forwarderTrackingNo" TEXT,
    "localCarrier" TEXT,
    "localTrackingNo" TEXT,
    "channelInvoiceStatus" "InvoiceRegisterStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "channelInvoicePayload" JSONB,
    "weightGrams" INTEGER,
    "shippingCostKrw" INTEGER NOT NULL DEFAULT 0,
    "events" JSONB,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shipments_orderId_key" ON "shipments"("orderId");
CREATE INDEX IF NOT EXISTS "shipments_tenantId_status_idx" ON "shipments"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "shipments_tenantId_createdAt_idx" ON "shipments"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_recommendations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "draftId" TEXT,
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "reasonCode" TEXT,
    "reasonText" TEXT,
    "detailHtml" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "ignoredAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "resultingSales" INTEGER NOT NULL DEFAULT 0,
    "resultingProfit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_recommendations_tenantId_status_createdAt_idx" ON "ai_recommendations"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_recommendations_tenantId_score_idx" ON "ai_recommendations"("tenantId", "score");
CREATE INDEX IF NOT EXISTS "ai_recommendations_productId_idx" ON "ai_recommendations"("productId");

CREATE TABLE IF NOT EXISTS "ai_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_conversations_tenantId_createdAt_idx" ON "ai_conversations"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metricsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_conversation_messages_conversationId_createdAt_idx" ON "ai_conversation_messages"("conversationId", "createdAt");

-- Product FKs
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "SourceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill products from existing SourceProduct + latest draft
INSERT INTO "products" (
  "id", "tenantId", "sourceProductId", "draftId", "title", "titleKo", "brand", "status",
  "sourceMall", "sourceUrl", "externalId", "currency", "sourcePrice", "salePriceKrw",
  "inStock", "images", "createdAt", "updatedAt"
)
SELECT
  'prod_' || sp."id",
  sp."tenantId",
  sp."id",
  d."id",
  sp."title",
  d."titleKo",
  sp."brand",
  'DRAFTING',
  sp."mall",
  sp."sourceUrl",
  sp."externalId",
  sp."currency",
  sp."sourcePrice",
  d."salePriceKrw",
  sp."inStock",
  sp."images",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SourceProduct" sp
LEFT JOIN LATERAL (
  SELECT pd.* FROM "ProductDraft" pd
  WHERE pd."sourceProductId" = sp."id"
  ORDER BY pd."createdAt" DESC
  LIMIT 1
) d ON true
ON CONFLICT DO NOTHING;
