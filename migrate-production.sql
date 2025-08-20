-- Production database migration script
-- Safely add new columns and migrate existing data

-- 1. Create RetirementMode enum if it doesn't exist
CREATE TYPE "RetirementMode" AS ENUM ('NONE', 'REDIRECT', 'GONE');

-- 2. Add new columns to Whop table
ALTER TABLE "Whop" 
ADD COLUMN IF NOT EXISTS "locale" TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS "indexingStatus" TEXT,
ADD COLUMN IF NOT EXISTS "retired" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "retirement" "RetirementMode" DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "redirectToPath" TEXT;

-- 3. Migrate data from existing 'indexing' column to new 'indexingStatus' column
UPDATE "Whop" SET "indexingStatus" = "indexing"::TEXT WHERE "indexingStatus" IS NULL;

-- 4. Set retirement status based on any existing retired boolean (if it exists)
-- This is safe because we're adding the column with DEFAULT false
UPDATE "Whop" SET "retirement" = 
  CASE WHEN "retired" = true THEN 'GONE'::"RetirementMode" 
       ELSE 'NONE'::"RetirementMode" 
  END;

-- 5. Create indexes for new columns
CREATE INDEX IF NOT EXISTS "Whop_indexingStatus_idx" ON "Whop"("indexingStatus");
CREATE INDEX IF NOT EXISTS "Whop_locale_idx" ON "Whop"("locale");
CREATE INDEX IF NOT EXISTS "Whop_retired_idx" ON "Whop"("retired");
CREATE INDEX IF NOT EXISTS "Whop_retirement_idx" ON "Whop"("retirement");

-- 6. Verify migration
-- SELECT COUNT(*) as total_whops, 
--        COUNT(CASE WHEN "indexingStatus" IS NOT NULL THEN 1 END) as has_indexing_status,
--        COUNT(CASE WHEN "retirement" IS NOT NULL THEN 1 END) as has_retirement
-- FROM "Whop";