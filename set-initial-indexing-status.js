const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setInitialIndexingStatus() {
  try {
    console.log('🚀 Setting initial indexing status for all whops...');

    // High-traffic courses that should stay indexed
    const highTrafficCourses = [
      'Brez marketing ERT',
      'Remakeit.io creator', 
      'Interbank Trading Room',
      'Josh Exclusive VIP Access',
      'EquiFix',
      'LinkedIn Client Lab',
      'Lowkey Discord Membership',
      'Risen Consulting',
      'Learn to Trade Academy',
      'Royalty Hero Premium',
      'The Blue Vortex',
      'ThinkorSwim Blessing',
      'ThinkorSwim Master Scalper',
      'Korvato Gold Rush'
    ];

    // Get all whops with their promo codes
    const whops = await prisma.whop.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        indexing: true,
        PromoCode: {
          select: {
            id: true
          }
        }
      }
    });

    console.log(`📊 Found ${whops.length} whops to process`);

    let indexedCount = 0;
    let noindexedCount = 0;
    let autoCount = 0;
    let unchangedCount = 0;

    // Batch updates for efficiency
    const indexUpdates = [];
    const noindexUpdates = [];

    for (const whop of whops) {
      // Skip if already manually set (not AUTO)
      if (whop.indexing !== 'AUTO') {
        unchangedCount++;
        continue;
      }

      const hasPromoCode = whop.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        whop.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(whop.name.toLowerCase())
      );
      
      const shouldIndex = hasPromoCode || isHighTraffic;
      
      if (shouldIndex) {
        indexUpdates.push(whop.id);
        indexedCount++;
        console.log(`✅ ${whop.name} → INDEX (${hasPromoCode ? 'Has promo codes' : 'High traffic'})`);
      } else {
        noindexUpdates.push(whop.id);
        noindexedCount++;
        if (noindexedCount % 100 === 0) {
          console.log(`🚫 Processing... ${noindexedCount} pages marked for NOINDEX`);
        }
      }
    }

    // Batch update all INDEX pages
    if (indexUpdates.length > 0) {
      console.log(`\n📈 Batch updating ${indexUpdates.length} pages to INDEX...`);
      await prisma.whop.updateMany({
        where: { id: { in: indexUpdates } },
        data: { indexing: 'INDEX' }
      });
    }

    // Batch update all NOINDEX pages
    if (noindexUpdates.length > 0) {
      console.log(`📉 Batch updating ${noindexUpdates.length} pages to NOINDEX...`);
      await prisma.whop.updateMany({
        where: { id: { in: noindexUpdates } },
        data: { indexing: 'NOINDEX' }
      });
    }

    console.log('\n🎉 INDEXING STATUS UPDATE COMPLETE!');
    console.log(`   📈 Set to INDEX: ${indexedCount}`);
    console.log(`   📉 Set to NOINDEX: ${noindexedCount}`);
    console.log(`   ⏳ Left unchanged (manual): ${unchangedCount}`);
    console.log(`   📊 Total processed: ${indexedCount + noindexedCount + unchangedCount}`);

    // Show summary by status
    const statusSummary = await prisma.whop.groupBy({
      by: ['indexing'],
      _count: {
        indexing: true
      }
    });

    console.log('\n📈 FINAL STATUS SUMMARY:');
    statusSummary.forEach(group => {
      const emoji = group.indexing === 'INDEX' ? '✅' : group.indexing === 'NOINDEX' ? '🚫' : '⚙️';
      console.log(`   ${emoji} ${group.indexing}: ${group._count.indexing} pages`);
    });

    console.log('\n💡 You can now control indexing manually in Neon database:');
    console.log('   - Set indexing = "INDEX" to force indexing');
    console.log('   - Set indexing = "NOINDEX" to force no-indexing');
    console.log('   - Set indexing = "AUTO" to use automatic logic');

  } catch (error) {
    console.error('❌ Error setting indexing status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setInitialIndexingStatus();