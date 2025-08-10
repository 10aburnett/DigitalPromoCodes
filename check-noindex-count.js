const { PrismaClient } = require('@prisma/client');

async function checkNoindexCount() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
      }
    }
  });

  try {
    console.log('🔍 Checking current indexing status...\n');

    // Get total published pages
    const totalPublished = await prisma.whop.count({
      where: { publishedAt: { not: null } }
    });

    // Get pages that SHOULD be in sitemap (not NOINDEX)
    const indexablePages = await prisma.whop.count({
      where: {
        AND: [
          { publishedAt: { not: null } },
          { indexing: { not: 'NOINDEX' } }
        ]
      }
    });

    // Get pages that should NOT be in sitemap (NOINDEX)
    const noindexPages = await prisma.whop.count({
      where: {
        AND: [
          { publishedAt: { not: null } },
          { indexing: 'NOINDEX' }
        ]
      }
    });

    // Get indexing status breakdown
    const indexingBreakdown = await prisma.whop.groupBy({
      by: ['indexing'],
      where: { publishedAt: { not: null } },
      _count: { _all: true }
    });

    console.log('📊 INDEXING STATUS BREAKDOWN:');
    console.log('===============================');
    console.log(`📄 Total published pages: ${totalPublished}`);
    console.log(`✅ Should be in sitemap: ${indexablePages}`);
    console.log(`🚫 Should NOT be in sitemap (NOINDEX): ${noindexPages}`);
    console.log('');

    console.log('📋 Detailed breakdown by indexing status:');
    indexingBreakdown.forEach(item => {
      const status = item.indexing || 'NULL';
      const count = item._count._all;
      const icon = status === 'NOINDEX' ? '🚫' : status === 'INDEX' ? '✅' : '⚪';
      console.log(`${icon} ${status}: ${count} pages`);
    });

    console.log('');
    console.log('🎯 EXPECTED SITEMAP SIZE:', indexablePages);
    console.log('🚨 CURRENT SITEMAP SIZE: 8,226 (from your screenshot)');
    
    if (indexablePages < 8226) {
      console.log('✅ Fix is working! Sitemap should shrink after cache expires.');
    } else {
      console.log('❌ Something is wrong - investigating...');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNoindexCount().catch(console.error);