const { PrismaClient } = require('@prisma/client');

// Check backup database (rough-rain) - has the complete data with fake promos
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function generateFinalIndexingReport() {
  try {
    console.log('📊 FINAL INDEXING STATUS REPORT\n');
    console.log('='.repeat(50));

    // 1. Static Pages (Always Indexed by Next.js)
    const staticPages = [
      { name: 'Home', path: '/', description: 'Main landing page' },
      { name: 'About', path: '/about', description: 'About us page' },
      { name: 'Contact', path: '/contact', description: 'Contact form page' },
      { name: 'Privacy Policy', path: '/privacy', description: 'Privacy policy page' },
      { name: 'Terms of Service', path: '/terms', description: 'Terms and conditions' },
      { name: 'Blog', path: '/blog', description: 'Blog listing page' },
      { name: 'Subscribe', path: '/subscribe', description: 'Newsletter signup' },
      { name: 'Unsubscribe', path: '/unsubscribe', description: 'Newsletter unsubscribe' }
    ];

    console.log('🏠 STATIC PAGES (Always Indexed):');
    console.log(`   Count: ${staticPages.length} pages`);
    staticPages.forEach(page => {
      console.log(`   ✅ ${page.name} (${page.path}) - ${page.description}`);
    });

    // 2. Whop Pages (Database Controlled)
    const indexedWhops = await backupDb.whop.findMany({
      where: { indexing: 'INDEX' },
      select: {
        id: true,
        name: true,
        slug: true,
        PromoCode: {
          select: { id: true, code: true, value: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const noindexedWhops = await backupDb.whop.count({
      where: { indexing: 'NOINDEX' }
    });

    const autoWhops = await backupDb.whop.count({
      where: { indexing: 'AUTO' }
    });

    console.log('\n🎯 WHOP PAGES (Database Controlled):');
    console.log(`   ✅ INDEXED: ${indexedWhops.length} whop pages`);
    console.log(`   🚫 NOINDEXED: ${noindexedWhops} whop pages`);
    console.log(`   ⚙️ AUTO: ${autoWhops} whop pages`);

    // Categorize indexed whops
    let realPromoPages = 0;
    let fakePromoPages = 0;
    let noPromoPages = 0;

    const highTrafficCourses = [
      'Brez marketing ERT', 'Remakeit.io creator', 'Interbank Trading Room',
      'Josh Exclusive VIP Access', 'EquiFix', 'LinkedIn Client Lab',
      'Lowkey Discord Membership', 'Risen Consulting', 'Learn to Trade Academy',
      'Royalty Hero Premium', 'The Blue Vortex', 'ThinkorSwim Blessing',
      'ThinkorSwim Master Scalper', 'Korvato Gold Rush'
    ];

    const fakePromoCodes = ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15', 'LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10', 'DISCOUNT30', 'SAVE25', 'OFF20', 'DEAL35', 'PROMO40'];

    console.log('\n📋 INDEXED WHOP BREAKDOWN:');

    indexedWhops.forEach(whop => {
      const hasPromoCode = whop.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        whop.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(whop.name.toLowerCase())
      );

      if (!hasPromoCode) {
        noPromoPages++;
        console.log(`   ⚪ ${whop.name} - No promo codes (generic page)`);
      } else {
        const hasFakePromo = whop.PromoCode.some(promo => fakePromoCodes.includes(promo.code));
        if (hasFakePromo) {
          fakePromoPages++;
          const fakePromo = whop.PromoCode.find(promo => fakePromoCodes.includes(promo.code));
          console.log(`   🎯 ${whop.name} - Fake promo: ${fakePromo.code} (${fakePromo.value}% off)`);
        } else {
          realPromoPages++;
          const realPromo = whop.PromoCode[0];
          console.log(`   💎 ${whop.name} - Real promo: ${realPromo.code} (${realPromo.value}% off)`);
        }
      }
    });

    // 3. Blog Posts (Dynamic, but Always Indexed)
    const blogPosts = await backupDb.blogPost.count({
      where: { published: true }
    });

    console.log('\n📝 BLOG POSTS (Always Indexed):');
    console.log(`   Count: ${blogPosts} published blog posts`);
    console.log(`   ✅ All published blog posts are indexed by default`);

    // 4. Final Summary
    console.log('\n' + '='.repeat(50));
    console.log('🏆 FINAL INDEXING SUMMARY:');
    console.log('='.repeat(50));

    const totalIndexedPages = staticPages.length + indexedWhops.length + blogPosts;

    console.log(`📊 TOTAL INDEXED PAGES: ${totalIndexedPages}`);
    console.log('');
    console.log('📄 BREAKDOWN:');
    console.log(`   🏠 Static pages: ${staticPages.length}`);
    console.log(`   🎯 Whop pages (indexed): ${indexedWhops.length}`);
    console.log(`   📝 Blog posts: ${blogPosts}`);
    console.log('');
    console.log('🎯 WHOP PAGES DETAIL:');
    console.log(`   💎 With real promo codes: ${realPromoPages}`);
    console.log(`   🎯 With fake promo codes: ${fakePromoPages}`);
    console.log(`   ⚪ Without promo codes: ${noPromoPages}`);
    console.log(`   🚫 Noindexed (thin content): ${noindexedWhops}`);
    console.log('');
    console.log('✅ SEO STRATEGY STATUS: COMPLETE');
    console.log(`   📈 Valuable pages indexed: ${totalIndexedPages}`);
    console.log(`   📉 Thin content removed: ${noindexedWhops}`);
    console.log(`   🎯 Indexing ratio: ${Math.round((indexedWhops.length / (indexedWhops.length + noindexedWhops)) * 100)}% quality pages`);

  } catch (error) {
    console.error('❌ Error generating report:', error);
  } finally {
    await backupDb.$disconnect();
  }
}

generateFinalIndexingReport();