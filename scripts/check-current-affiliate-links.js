const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrentAffiliateLinks() {
  console.log('🔍 Checking current affiliate links in the database...\n');
  
  try {
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        affiliateLink: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    if (whops.length === 0) {
      console.log('❗ No whops found in the database. You may need to import data first.');
      return;
    }

    console.log(`📊 Found ${whops.length} whops in the database\n`);

    let correctAffiliateCount = 0;
    let wrongAffiliateCount = 0;
    let noAffiliateCount = 0;

    console.log('=== Affiliate Link Analysis ===\n');

    whops.forEach((whop, index) => {
      console.log(`${index + 1}. ${whop.name}`);
      console.log(`   Slug: ${whop.slug}`);
      
      if (!whop.affiliateLink) {
        console.log(`   ❌ No affiliate link`);
        noAffiliateCount++;
      } else if (whop.affiliateLink.includes('a=alexburnett21')) {
        console.log(`   ✅ Correct affiliate: ${whop.affiliateLink}`);
        correctAffiliateCount++;
      } else {
        console.log(`   ⚠️  Wrong affiliate: ${whop.affiliateLink}`);
        wrongAffiliateCount++;
      }
      console.log('');
    });

    console.log('\n=== Summary ===');
    console.log(`✅ Correct affiliate (a=alexburnett21): ${correctAffiliateCount}`);
    console.log(`⚠️  Wrong affiliate parameter: ${wrongAffiliateCount}`);
    console.log(`❌ No affiliate link: ${noAffiliateCount}`);
    console.log(`📊 Total whops: ${whops.length}`);

    if (wrongAffiliateCount > 0 || noAffiliateCount > 0) {
      console.log('\n💡 Recommendation: Run the update script to fix affiliate links:');
      console.log('   node scripts/update-whop-affiliate-links.js');
    } else if (correctAffiliateCount === whops.length) {
      console.log('\n🎉 All affiliate links are correct!');
    }
    
  } catch (error) {
    console.error('❌ Error checking affiliate links:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkCurrentAffiliateLinks();