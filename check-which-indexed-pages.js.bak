const { PrismaClient } = require('@prisma/client');

// Check current database (should be backup based on your .env)
const prisma = new PrismaClient();

async function checkIndexedPages() {
  try {
    console.log('🔍 CHECKING WHICH PAGES ARE INDEXED AND WHY\n');

    // Get all indexed pages with their promo codes
    const indexedPages = await prisma.whop.findMany({
      where: {
        indexing: 'INDEX'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        PromoCode: {
          select: {
            id: true,
            code: true,
            value: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`📊 Found ${indexedPages.length} indexed pages:`);

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

    let staticLikePages = [];
    let highTrafficPages = [];
    let promoCodePages = [];

    indexedPages.forEach(page => {
      const hasPromoCode = page.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        page.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(page.name.toLowerCase())
      );

      // Classify the page
      if (page.name.length <= 15 && (page.name === 'Academy' || page.name === 'Access' || page.name === 'VIP' || page.name === 'Premium' || page.name === 'Member' || page.name === 'Trading' || page.name === 'Hero' || page.name === 'Discord' || page.name === 'Exclusive' || page.name === 'Membership' || page.name === 'CREATOR' || page.name === 'TRADING ROOM')) {
        staticLikePages.push({
          ...page,
          reason: 'Generic/Static-like name',
          shouldHavePromo: false
        });
      } else if (isHighTraffic) {
        highTrafficPages.push({
          ...page,
          reason: 'High traffic course',
          shouldHavePromo: true
        });
      } else if (hasPromoCode) {
        promoCodePages.push({
          ...page,
          reason: 'Has promo codes',
          shouldHavePromo: true
        });
      }
    });

    console.log('\n🏠 STATIC/GENERIC PAGES (shouldn\'t need fake promos):');
    staticLikePages.forEach(page => {
      const promoStatus = page.PromoCode.length > 0 ? `✅ ${page.PromoCode.length} promo(s)` : '❌ No promos';
      console.log(`   • ${page.name} - ${promoStatus}`);
    });

    console.log('\n🎯 HIGH-TRAFFIC COURSES (should have promos):');
    highTrafficPages.forEach(page => {
      const promoStatus = page.PromoCode.length > 0 ? `✅ ${page.PromoCode.length} promo(s)` : '❌ No promos';
      console.log(`   • ${page.name} - ${promoStatus}`);
      if (page.PromoCode.length > 0) {
        page.PromoCode.forEach(promo => {
          const isRecent = new Date(promo.createdAt) > new Date(Date.now() - 60*60*1000); // Last hour
          const recentFlag = isRecent ? '🆕' : '';
          console.log(`     - ${promo.code} (${promo.value}% off) ${recentFlag}`);
        });
      }
    });

    console.log('\n💰 PROMO CODE PAGES (already had promos):');
    promoCodePages.forEach(page => {
      console.log(`   • ${page.name} - ✅ ${page.PromoCode.length} promo(s)`);
    });

    console.log('\n📊 SUMMARY:');
    console.log(`   🏠 Static/Generic pages: ${staticLikePages.length}`);
    console.log(`   🎯 High-traffic courses: ${highTrafficPages.length}`);
    console.log(`   💰 Original promo pages: ${promoCodePages.length}`);
    console.log(`   📈 Total indexed: ${indexedPages.length}`);

    // Check database connection info
    console.log('\n💾 DATABASE INFO:');
    console.log(`   Connected to: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.includes('rough-rain') ? 'BACKUP DB (rough-rain)' : process.env.DATABASE_URL.includes('noisy-hat') ? 'PRODUCTION DB (noisy-hat)' : 'Unknown DB' : 'Default connection'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIndexedPages();