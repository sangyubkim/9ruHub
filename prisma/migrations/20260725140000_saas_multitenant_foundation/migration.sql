-- Step 0: SaaS multi-tenant foundation
-- Breaking reshape of early schema → reset local DB if migrate fails, then re-seed.

-- Drop legacy tables/enums (safe for early Phase 1–2 local DB)
DROP TABLE IF EXISTS "PublishLog" CASCADE;
DROP TABLE IF EXISTS "SyncJob" CASCADE;
DROP TABLE IF EXISTS "ChannelListing" CASCADE;
DROP TABLE IF EXISTS "ProductDraft" CASCADE;
DROP TABLE IF EXISTS "SourceProduct" CASCADE;
DROP TABLE IF EXISTS "PriceRule" CASCADE;
DROP TABLE IF EXISTS "ai_conversation_messages" CASCADE;
DROP TABLE IF EXISTS "ai_conversations" CASCADE;
DROP TABLE IF EXISTS "ai_recommendations" CASCADE;
DROP TABLE IF EXISTS "shipments" CASCADE;
DROP TABLE IF EXISTS "order_items" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "product_price_history" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "tenant_members" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "tenants" CASCADE;

DROP TYPE IF EXISTS "ConversationRole" CASCADE;
DROP TYPE IF EXISTS "InvoiceRegisterStatus" CASCADE;
DROP TYPE IF EXISTS "ShipmentStatus" CASCADE;
DROP TYPE IF EXISTS "PurchaseAttemptStatus" CASCADE;
DROP TYPE IF EXISTS "OrderStatus" CASCADE;
DROP TYPE IF EXISTS "RecommendationStatus" CASCADE;
DROP TYPE IF EXISTS "ProductStatus" CASCADE;
DROP TYPE IF EXISTS "MemberRole" CASCADE;
DROP TYPE IF EXISTS "SyncJobStatus" CASCADE;
DROP TYPE IF EXISTS "SyncJobType" CASCADE;
DROP TYPE IF EXISTS "ListingStatus" CASCADE;
DROP TYPE IF EXISTS "Channel" CASCADE;
DROP TYPE IF EXISTS "SourceMall" CASCADE;
DROP TYPE IF EXISTS "DraftStatus" CASCADE;

CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'READY', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "SourceMall" AS ENUM ('AMAZON_US', 'OTHER');
CREATE TYPE "Channel" AS ENUM ('SMARTSTORE', 'COUPANG');
CREATE TYPE "ListingStatus" AS ENUM ('NOT_CREATED', 'PENDING', 'LIVE', 'SUSPENDED', 'FAILED');
CREATE TYPE "SyncJobType" AS ENUM ('PRICE', 'STOCK', 'FULL');
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "ProductStatus" AS ENUM ('SOURCING', 'DRAFTING', 'LISTED', 'ARCHIVED');
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IGNORED', 'DRAFT_CREATED', 'CONVERTED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PURCHASE_REQUESTED', 'PURCHASED', 'SHIPPED_TO_FORWARDER', 'IN_FORWARDER', 'SHIPPED_TO_CUSTOMER', 'DELIVERED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "PurchaseAttemptStatus" AS ENUM ('STUBBED', 'QUEUED', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'AT_FORWARDER', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'CANCELLED');
CREATE TYPE "InvoiceRegisterStatus" AS ENUM ('NOT_REQUESTED', 'STUBBED', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ConversationRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "usdToKrw" DECIMAL(12,4) NOT NULL,
    "marginRate" DECIMAL(6,4) NOT NULL,
    "shippingFeeKrw" INTEGER NOT NULL DEFAULT 15000,
    "agencyFeeKrw" INTEGER NOT NULL DEFAULT 3000,
    "platformFeeRate" DECIMAL(6,4) NOT NULL DEFAULT 0.10,
    "dutyRate" DECIMAL(6,4) NOT NULL DEFAULT 0.08,
    "roundTo" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mall" "SourceMall" NOT NULL DEFAULT 'AMAZON_US',
    "sourceUrl" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sourcePrice" DECIMAL(12,2) NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "images" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "rawPayload" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SourceProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceProductId" TEXT NOT NULL,
    "titleKo" TEXT NOT NULL,
    "detailHtml" TEXT NOT NULL,
    "salePriceKrw" INTEGER NOT NULL,
    "costBreakdown" JSONB NOT NULL,
    "images" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "noticeText" TEXT NOT NULL,
    "categoryHint" TEXT,
    "isFallbackData" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChannelListing" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'NOT_CREATED',
    "externalProductId" TEXT,
    "lastPayload" JSONB,
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChannelListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishLog" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_price_history" (
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

CREATE TABLE "orders" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
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

CREATE TABLE "shipments" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_recommendations" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metricsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "tenant_members_tenantId_userId_key" ON "tenant_members"("tenantId", "userId");
CREATE INDEX "tenant_members_userId_idx" ON "tenant_members"("userId");
CREATE UNIQUE INDEX "PriceRule_tenantId_name_key" ON "PriceRule"("tenantId", "name");
CREATE INDEX "PriceRule_tenantId_idx" ON "PriceRule"("tenantId");
CREATE UNIQUE INDEX "SourceProduct_tenantId_mall_externalId_key" ON "SourceProduct"("tenantId", "mall", "externalId");
CREATE INDEX "SourceProduct_tenantId_createdAt_idx" ON "SourceProduct"("tenantId", "createdAt");
CREATE INDEX "SourceProduct_sourceUrl_idx" ON "SourceProduct"("sourceUrl");
CREATE INDEX "ProductDraft_tenantId_status_idx" ON "ProductDraft"("tenantId", "status");
CREATE INDEX "ProductDraft_tenantId_createdAt_idx" ON "ProductDraft"("tenantId", "createdAt");
CREATE INDEX "ProductDraft_status_idx" ON "ProductDraft"("status");
CREATE INDEX "ProductDraft_createdAt_idx" ON "ProductDraft"("createdAt");
CREATE UNIQUE INDEX "ChannelListing_draftId_channel_key" ON "ChannelListing"("draftId", "channel");
CREATE INDEX "ChannelListing_channel_status_idx" ON "ChannelListing"("channel", "status");
CREATE INDEX "SyncJob_status_createdAt_idx" ON "SyncJob"("status", "createdAt");
CREATE INDEX "PublishLog_draftId_createdAt_idx" ON "PublishLog"("draftId", "createdAt");
CREATE UNIQUE INDEX "products_tenantId_sourceMall_externalId_key" ON "products"("tenantId", "sourceMall", "externalId");
CREATE INDEX "products_tenantId_status_idx" ON "products"("tenantId", "status");
CREATE INDEX "products_tenantId_updatedAt_idx" ON "products"("tenantId", "updatedAt");
CREATE INDEX "products_tenantId_createdAt_idx" ON "products"("tenantId", "createdAt");
CREATE INDEX "product_price_history_tenantId_recordedAt_idx" ON "product_price_history"("tenantId", "recordedAt");
CREATE INDEX "product_price_history_productId_recordedAt_idx" ON "product_price_history"("productId", "recordedAt");
CREATE UNIQUE INDEX "orders_tenantId_channel_externalOrderId_key" ON "orders"("tenantId", "channel", "externalOrderId");
CREATE INDEX "orders_tenantId_status_idx" ON "orders"("tenantId", "status");
CREATE INDEX "orders_tenantId_orderedAt_idx" ON "orders"("tenantId", "orderedAt");
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
CREATE UNIQUE INDEX "shipments_orderId_key" ON "shipments"("orderId");
CREATE INDEX "shipments_tenantId_status_idx" ON "shipments"("tenantId", "status");
CREATE INDEX "shipments_tenantId_createdAt_idx" ON "shipments"("tenantId", "createdAt");
CREATE INDEX "ai_recommendations_tenantId_status_createdAt_idx" ON "ai_recommendations"("tenantId", "status", "createdAt");
CREATE INDEX "ai_recommendations_tenantId_score_idx" ON "ai_recommendations"("tenantId", "score");
CREATE INDEX "ai_recommendations_productId_idx" ON "ai_recommendations"("productId");
CREATE INDEX "ai_conversations_tenantId_createdAt_idx" ON "ai_conversations"("tenantId", "createdAt");
CREATE INDEX "ai_conversation_messages_conversationId_createdAt_idx" ON "ai_conversation_messages"("conversationId", "createdAt");

ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceProduct" ADD CONSTRAINT "SourceProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductDraft" ADD CONSTRAINT "ProductDraft_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "SourceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductDraft" ADD CONSTRAINT "ProductDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishLog" ADD CONSTRAINT "PublishLog_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "SourceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ProductDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
