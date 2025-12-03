const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIndexingDatabase() {
  try {
    console.log('🔍 Checking indexing status in database...\n');

    // Get summary by indexing status
    const statusSummary = await prisma.whop.groupBy({
      by: ['indexing'],
      _count: {
        indexing: true
      }
    });

    console.log('📊 INDEXING STATUS SUMMARY:');
    statusSummary.forEach(group => {
      const emoji = group.indexing === 'INDEX' ? '✅' : group.indexing === 'NOINDEX' ? '🚫' : '⚙️';
      console.log(`   ${emoji} ${group.indexing}: ${group._count.indexing} pages`);
    });

    // Show some example pages that will be indexed
    console.log('\n✅ SAMPLE PAGES THAT WILL BE INDEXED:');
    const indexedPages = await prisma.whop.findMany({
      where: { indexing: 'INDEX' },
      select: { name: true, slug: true },
      take: 10,
      orderBy: { name: 'asc' }
    });
    indexedPages.forEach(page => {
      console.log(`   • ${page.name}`);
    });

    // Show some example pages that will be noindexed
    console.log('\n🚫 SAMPLE PAGES THAT WILL BE NOINDEXED:');
    const noindexedPages = await prisma.whop.findMany({
      where: { indexing: 'NOINDEX' },
      select: { name: true },
      take: 5,
      orderBy: { name: 'asc' }
    });
    noindexedPages.forEach(page => {
      console.log(`   • ${page.name}`);
    });

    console.log('\n💡 HOW TO MANUALLY CONTROL INDEXING:');
    console.log('   1. Go to your Neon database console');
    console.log('   2. Run: SELECT name, indexing FROM "Whop" WHERE name LIKE \'%search%\';');
    console.log('   3. To force index: UPDATE "Whop" SET indexing = \'INDEX\' WHERE name = \'Page Name\';');
    console.log('   4. To force noindex: UPDATE "Whop" SET indexing = \'NOINDEX\' WHERE name = \'Page Name\';');
    console.log('   5. To use automatic logic: UPDATE "Whop" SET indexing = \'AUTO\' WHERE name = \'Page Name\';');

    console.log('\n✨ Changes take effect immediately on next Google crawl!');

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIndexingDatabase();