const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import the getWhopBySlug function directly
async function testGetWhopBySlug() {
  try {
    console.log('🔍 Testing getWhopBySlug function directly...');
    
    const slug = 'ayecon-academy-1:1-mentorship';
    
    // Call the same logic as in the API
    const whop = await prisma.deal.findFirst({
      where: { 
        slug: slug,
        publishedAt: { not: null } // Non-admin, so only published
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        description: true,
        rating: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        affiliateLink: true,
        screenshots: true,
        website: true,
        price: true,
        category: true,
        aboutContent: true,
        howToRedeemContent: true,
        promoDetailsContent: true,
        featuresContent: true,
        termsContent: true,
        faqContent: true,
        whopCategory: true,
        indexing: true,
        PromoCode: {
          orderBy: { createdAt: 'desc' }
        },
        Review: {
          where: { verified: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!whop) {
      console.log('❌ No whop found');
      return;
    }

    console.log(`✅ Found whop: ${whop.name} (ID: ${whop.id})`);
    console.log(`   Original PromoCode count: ${whop.PromoCode.length}`);

    // Get community-submitted promo codes that have been approved for this whop
    const communityPromoCodes = await prisma.promoCode.findMany({
      where: {
        whopId: whop.id,
        id: { startsWith: 'community_' }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`   Community PromoCode count: ${communityPromoCodes.length}`);

    // Combine promo codes with community codes first, then original codes
    const allPromoCodes = [
      ...communityPromoCodes,
      ...whop.PromoCode.filter(code => !code.id.startsWith('community_'))
    ];

    console.log(`   Combined PromoCode count: ${allPromoCodes.length}`);
    
    console.log('\n📋 All combined promo codes:');
    allPromoCodes.forEach((promo, index) => {
      const isCommunity = promo.id.startsWith('community_');
      console.log(`  ${index + 1}. ${promo.id} - "${promo.title}" ${isCommunity ? '(COMMUNITY)' : '(ORIGINAL)'}`);
    });

    // Return whop with combined promo codes
    const result = {
      ...whop,
      PromoCode: allPromoCodes
    };

    console.log(`\n🎯 Final result: ${result.PromoCode.length} promo codes total`);
    
  } catch (error) {
    console.error('❌ Error testing getWhopBySlug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testGetWhopBySlug();