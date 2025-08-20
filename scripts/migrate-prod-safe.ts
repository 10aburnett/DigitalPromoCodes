import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('🔧 Running safe production migration...');

  try {
    // 1) Create enums if missing
    await prisma.$executeRawUnsafe(`
      DO $
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RetirementMode') THEN
          CREATE TYPE "RetirementMode" AS ENUM ('NONE','REDIRECT','GONE');
        END IF;
      END $;
    `);

    await prisma.$executeRawUnsafe(`
      DO $
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IndexingStatus') THEN
          CREATE TYPE "IndexingStatus" AS ENUM ('INDEX','NOINDEX','AUTO');
        END IF;
      END $;
    `);

    console.log('✅ Created enums');

    // 2) Add new columns if missing (ADD-ONLY; no drops)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Whop"
        ADD COLUMN IF NOT EXISTS "retirement" "RetirementMode" NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS "redirectToPath" TEXT,
        ADD COLUMN IF NOT EXISTS "indexingStatus" "IndexingStatus";
    `);

    console.log('✅ Added new columns');

    // 3) Backfill indexingStatus from legacy 'indexing' if present
    await prisma.$executeRawUnsafe(`
      DO $
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='Whop' AND column_name='indexing'
        ) THEN
          UPDATE "Whop"
          SET "indexingStatus" = "indexing"::"IndexingStatus"
          WHERE "indexingStatus" IS NULL;
        END IF;
      END $;
    `);

    console.log('✅ Backfilled indexingStatus from legacy indexing column');

    // 4) Backfill retirement from legacy boolean if present
    await prisma.$executeRawUnsafe(`
      DO $
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='Whop' AND column_name='retired'
        ) THEN
          UPDATE "Whop"
          SET "retirement" = 'GONE'
          WHERE "retired" = true AND "retirement" = 'NONE';
        END IF;
      END $;
    `);

    console.log('✅ Backfilled retirement from legacy retired boolean');

    // 5) Create helpful indexes (idempotent)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Whop_slug_idx" ON "Whop" ("slug");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Whop_retirement_idx" ON "Whop" ("retirement");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Whop_indexingStatus_idx" ON "Whop" ("indexingStatus");
    `);

    console.log('✅ Created indexes');

    // 6) Verify migration
    const verification = await prisma.$queryRaw<Array<{
      total_whops: number;
      has_retirement: number;
      has_indexing_status: number;
    }>>`
      SELECT 
        COUNT(*) as total_whops,
        COUNT(CASE WHEN "retirement" IS NOT NULL THEN 1 END) as has_retirement,
        COUNT(CASE WHEN "indexingStatus" IS NOT NULL THEN 1 END) as has_indexing_status
      FROM "Whop"
    `;

    console.log('🎯 Migration verification:', verification[0]);
    console.log('✅ Production migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();