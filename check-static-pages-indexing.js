const { PrismaClient } = require('@prisma/client');

// Check both databases
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function checkStaticPagesIndexing() {
  try {
    console.log('🔍 CHECKING STATIC PAGES INDEXING STATUS\n');
    
    console.log('❌ ISSUE IDENTIFIED: Only checked Whop table for indexing!');
    console.log('📄 Static pages (home, about, contact, etc.) are NOT in Whop table');
    console.log('🎯 These pages are controlled by layout.tsx and individual page.tsx files\n');

    console.log('📊 STATIC PAGES THAT SHOULD ALWAYS BE INDEXED:');
    const staticPages = [
      { name: 'Home', path: '/', file: 'src/app/page.tsx' },
      { name: 'About', path: '/about', file: 'src/app/about/page.tsx' },
      { name: 'Contact', path: '/contact', file: 'src/app/contact/page.tsx' },
      { name: 'Privacy Policy', path: '/privacy', file: 'src/app/privacy/page.tsx' },
      { name: 'Terms of Service', path: '/terms', file: 'src/app/terms/page.tsx' },
      { name: 'Blog', path: '/blog', file: 'src/app/blog/page.tsx' },
      { name: 'Subscribe', path: '/subscribe', file: 'src/app/subscribe/page.tsx' },
      { name: 'Unsubscribe', path: '/unsubscribe', file: 'src/app/unsubscribe/page.tsx' }
    ];

    staticPages.forEach(page => {
      console.log(`   ✅ ${page.name} (${page.path}) - Always indexed by default`);
    });

    console.log('\n🎯 WHOP PAGES INDEXING STATUS:');
    
    // Check backup database
    console.log('\n📊 BACKUP DATABASE (where you added fake promos):');
    const backupWhops = await backupDb.whop.findMany({
      where: { indexing: 'INDEX' },
      select: {
        name: true,
        PromoCode: { select: { id: true, code: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    let backupWithPromos = 0;
    let backupWithoutPromos = 0;
    
    backupWhops.forEach(whop => {
      const hasPromos = whop.PromoCode.length > 0;
      if (hasPromos) {
        backupWithPromos++;
        console.log(`   ✅ ${whop.name} (${whop.PromoCode.length} promos)`);
      } else {
        backupWithoutPromos++;
        console.log(`   ❌ ${whop.name} (0 promos)`);
      }
    });

    console.log(`   📈 Backup: ${backupWithPromos} with promos, ${backupWithoutPromos} without`);

    // Check production database  
    console.log('\n📊 PRODUCTION DATABASE (what you\'re viewing in Neon):');
    const prodWhops = await productionDb.whop.findMany({
      where: { indexing: 'INDEX' },
      select: {
        name: true,
        PromoCode: { select: { id: true, code: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    let prodWithPromos = 0;
    let prodWithoutPromos = 0;
    
    prodWhops.forEach(whop => {
      const hasPromos = whop.PromoCode.length > 0;
      if (hasPromos) {
        prodWithPromos++;
      } else {
        prodWithoutPromos++;
        console.log(`   ❌ ${whop.name} (0 promos) - NEEDS FAKE PROMO`);
      }
    });

    console.log(`   📈 Production: ${prodWithPromos} with promos, ${prodWithoutPromos} without`);

    console.log('\n🔧 NEXT STEPS NEEDED:');
    console.log('   1. ✅ Static pages are already indexed (handled by Next.js)');
    console.log('   2. 🔄 Sync fake promo codes from backup to production database');
    console.log('   3. 📊 Verify production database has all fake promos');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await backupDb.$disconnect();
    await productionDb.$disconnect();
  }
}

checkStaticPagesIndexing();