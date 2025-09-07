// Raw SQL verification script for content migration  
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigrationRaw() {
  try {
    console.log('🔍 Verifying content migration with raw SQL...\n');

    // 1) Total rows
    const totalResult = await prisma.$queryRaw`SELECT COUNT(*) AS total_rows FROM "BlogPost"`;
    console.log(`1. Total rows:`, totalResult);

    // 2) Count of rows with old data vs new data
    const countsResult = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE "content" IS NOT NULL) AS old_non_null,
        COUNT(*) FILTER (WHERE "content_text" IS NOT NULL) AS new_non_null
      FROM "BlogPost"
    `;
    console.log(`2. Content counts:`, countsResult);

    // 3) Check for differences
    const diffResult = await prisma.$queryRaw`
      SELECT COUNT(*) AS diff_count
      FROM "BlogPost"
      WHERE COALESCE("content"::text, '') <> COALESCE("content_text", '')
    `;
    console.log(`3. Differences:`, diffResult);

    // 4) Show sample of any differences
    const sampleDiffs = await prisma.$queryRaw`
      SELECT id, LEFT("content"::text, 50) as old_content, LEFT("content_text", 50) as new_content
      FROM "BlogPost"
      WHERE COALESCE("content"::text, '') <> COALESCE("content_text", '')
      LIMIT 3
    `;
    console.log(`4. Sample differences:`, sampleDiffs);

    console.log('\n🎉 Raw SQL verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigrationRaw();