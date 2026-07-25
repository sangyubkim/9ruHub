-- AlterTable: AI 상세페이지 키워드·메타
ALTER TABLE "ProductDraft" ADD COLUMN IF NOT EXISTS "keywords" JSONB;
ALTER TABLE "ProductDraft" ADD COLUMN IF NOT EXISTS "aiMeta" JSONB;
