import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findTMSWhops() {
  console.log('Searching for TMS whops in the database...\n');

  try {
    // Define the TMS whop names we're looking for
    const tmsWhopNames = [
      'TMS+ (Heavy Hitters) 💎',
      'TMS (#1 ON WHOP)',
      'TMS Player Props 📊',
      'TMS Exclusive VIP Chat',
      'TMS Spartan AI Bot'
    ];

    // Search for whops with names containing "TMS"
    const tmsWhops = await prisma.whop.findMany({
      where: {
        name: {
          contains: 'TMS',
          mode: 'insensitive'
        }
      },
      include: {
        PromoCode: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${tmsWhops.length} whops containing "TMS":\n`);

    tmsWhops.forEach((whop, index) => {
      console.log(`${index + 1}. Whop: "${whop.name}"`);
      console.log(`   ID: ${whop.id}`);
      console.log(`   Slug: ${whop.slug}`);
      console.log(`   Published: ${whop.publishedAt ? 'Yes' : 'No'}`);
      console.log(`   Price: ${whop.price || 'N/A'}`);
      console.log(`   Category: ${whop.whopCategory}`);
      console.log(`   Affiliate Link: ${whop.affiliateLink}`);
      
      if (whop.PromoCode.length > 0) {
        console.log(`   Promo Codes (${whop.PromoCode.length}):`);
        whop.PromoCode.forEach((promo, promoIndex) => {
          console.log(`     ${promoIndex + 1}. Title: "${promo.title}"`);
          console.log(`        Code: ${promo.code || 'NO CODE REQUIRED'}`);
          console.log(`        Type: ${promo.type}`);
          console.log(`        Value: ${promo.value}`);
          console.log(`        Description: ${promo.description}`);
          console.log(`        ID: ${promo.id}`);
          console.log('');
        });
      } else {
        console.log(`   Promo Codes: None`);
      }
      console.log('   ' + '='.repeat(60));
      console.log('');
    });

    // Also search for any whops that might be variations or contain similar terms
    console.log('\nSearching for whops with "Trust My Stocks" or similar terms...\n');
    
    const trustMyStocksWhops = await prisma.whop.findMany({
      where: {
        OR: [
          { name: { contains: 'Trust My Stock', mode: 'insensitive' } },
          { name: { contains: 'Spartan AI', mode: 'insensitive' } },
          { description: { contains: 'TMS', mode: 'insensitive' } }
        ]
      },
      include: {
        PromoCode: true
      }
    });

    if (trustMyStocksWhops.length > 0) {
      console.log(`Found ${trustMyStocksWhops.length} additional related whops:`);
      trustMyStocksWhops.forEach((whop, index) => {
        if (!tmsWhops.find(existing => existing.id === whop.id)) {
          console.log(`${index + 1}. ${whop.name} (ID: ${whop.id})`);
        }
      });
    }

    // Summary of target whops
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY - Target TMS Whops Status:');
    console.log('='.repeat(80));

    for (const targetName of tmsWhopNames) {
      const found = tmsWhops.find(whop => whop.name === targetName);
      if (found) {
        console.log(`✅ FOUND: "${targetName}"`);
        console.log(`   Database ID: ${found.id}`);
        console.log(`   Published: ${found.publishedAt ? 'Yes' : 'No'}`);
        console.log(`   Promo Codes: ${found.PromoCode.length}`);
        if (found.PromoCode.length > 0) {
          found.PromoCode.forEach(promo => {
            console.log(`     - "${promo.title}" (Code: ${promo.code || 'NO CODE REQUIRED'})`);
          });
        }
      } else {
        console.log(`❌ NOT FOUND: "${targetName}"`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error searching for TMS whops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the search
findTMSWhops();