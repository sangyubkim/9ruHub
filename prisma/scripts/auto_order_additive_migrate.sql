-- Auto-order pipeline: additive OrderStatus values + order_events
-- Safe to re-run (IF NOT EXISTS / DO blocks).

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SOURCING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CART_READY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT_CONFIRM';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FORWARDER_ADDRESS_SET';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PURCHASE_COMPLETE';

CREATE TABLE IF NOT EXISTS "order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_events_orderId_createdAt_idx"
  ON "order_events"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
