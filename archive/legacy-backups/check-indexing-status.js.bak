const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIndexingStatus() {
  try {
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
        PromoCode: {
          select: {
            id: true,
            code: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('\n=== INDEXING STATUS REPORT ===\n');

    let indexedCount = 0;
    let noindexedCount = 0;
    const indexed = [];
    const noindexed = [];

    whops.forEach(whop => {
      const hasPromoCode = whop.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        whop.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(whop.name.toLowerCase())
      );
      
      const shouldIndex = hasPromoCode || isHighTraffic;
      
      if (shouldIndex) {
        indexedCount++;
        indexed.push({
          name: whop.name,
          slug: whop.slug,
          reason: hasPromoCode ? 'Has promo codes' : 'High traffic course',
          promoCount: whop.PromoCode.length
        });
      } else {
        noindexedCount++;
        noindexed.push({
          name: whop.name,
          slug: whop.slug,
          promoCount: whop.PromoCode.length
        });
      }
    });

    console.log(`📊 SUMMARY:`);
    console.log(`   Total pages: ${whops.length}`);
    console.log(`   ✅ Will be INDEXED: ${indexedCount}`);
    console.log(`   🚫 Will be NOINDEXED: ${noindexedCount}`);

    console.log(`\n✅ PAGES THAT WILL REMAIN INDEXED (${indexedCount}):`);
    indexed.forEach(item => {
      console.log(`   • ${item.name} (${item.reason}) - Promo codes: ${item.promoCount}`);
    });

    if (noindexed.length > 0) {
      console.log(`\n🚫 PAGES THAT WILL BE NOINDEXED (${noindexedCount}):`);
      noindexed.forEach(item => {
        console.log(`   • ${item.name} - Promo codes: ${item.promoCount}`);
      });
    }

    console.log('\n💡 Note: Static pages (home, about, contact, privacy, terms, blog, etc.) will always remain indexed.\n');

  } catch (error) {
    console.error('Error checking indexing status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIndexingStatus();