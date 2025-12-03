const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findSimilarIds() {
  try {
    console.log('🔍 Looking for whops with similar IDs...');
    
    // Look for the ID shown in debug box
    const debugBoxId = 'cmdezcn0b0000dv0ngzzv29o7';
    const debugBoxWhop = await prisma.deal.findUnique({
      where: { id: debugBoxId },
      include: { PromoCode: true }
    });
    
    if (debugBoxWhop) {
      console.log(`\n🎯 Found whop with debug box ID: ${debugBoxId}`);
      console.log(`   Name: ${debugBoxWhop.name}`);
      console.log(`   Slug: ${debugBoxWhop.slug}`);
      console.log(`   Promo codes: ${debugBoxWhop.PromoCode.length}`);
      debugBoxWhop.PromoCode.forEach((promo, index) => {
        const isCommunity = promo.id.startsWith('community_');
        console.log(`     ${index + 1}. ${promo.id} - "${promo.title}" ${isCommunity ? '(COMMUNITY)' : '(ORIGINAL)'}`);
      });
    } else {
      console.log(`❌ No whop found with ID: ${debugBoxId}`);
    }
    
    // Look for whops with IDs starting with cmdezcn0b
    const similarWhops = await prisma.deal.findMany({
      where: {
        id: { startsWith: 'cmdezcn0b' }
      },
      include: { PromoCode: true }
    });
    
    console.log(`\n📋 All whops with IDs starting with "cmdezcn0b" (${similarWhops.length} total):`);
    similarWhops.forEach((whop, index) => {
      console.log(`\n${index + 1}. "${whop.name}"`);
      console.log(`   ID: ${whop.id}`);
      console.log(`   Slug: ${whop.slug}`);
      console.log(`   Promo codes: ${whop.PromoCode.length}`);
      
      if (whop.PromoCode.length > 0) {
        whop.PromoCode.forEach((promo, promoIndex) => {
          const isCommunity = promo.id.startsWith('community_');
          console.log(`     ${promoIndex + 1}. ${promo.id} - "${promo.title}" ${isCommunity ? '(COMMUNITY)' : '(ORIGINAL)'}`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error finding similar IDs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
findSimilarIds();