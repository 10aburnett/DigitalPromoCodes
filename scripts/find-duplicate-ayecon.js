const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findDuplicateAyecon() {
  try {
    console.log('🔍 Looking for Ayecon Academy entries...');
    
    // Find all whops with Ayecon in the name
    const ayeconWhops = await prisma.deal.findMany({
      where: {
        OR: [
          { name: { contains: 'Ayecon', mode: 'insensitive' } },
          { slug: { contains: 'ayecon', mode: 'insensitive' } }
        ]
      },
      include: {
        PromoCode: true
      }
    });
    
    console.log(`Found ${ayeconWhops.length} Ayecon-related whops:`);
    
    ayeconWhops.forEach((whop, index) => {
      console.log(`\n${index + 1}. "${whop.name}"`);
      console.log(`   ID: ${whop.id}`);
      console.log(`   Slug: ${whop.slug}`);
      console.log(`   Published: ${whop.publishedAt ? 'Yes' : 'No'}`);
      console.log(`   Promo codes: ${whop.PromoCode.length}`);
      
      if (whop.PromoCode.length > 0) {
        whop.PromoCode.forEach((promo, promoIndex) => {
          const isCommunity = promo.id.startsWith('community_');
          console.log(`     ${promoIndex + 1}. ${promo.id} - "${promo.title}" ${isCommunity ? '(COMMUNITY)' : '(ORIGINAL)'}`);
        });
      }
    });
    
    // Check which one has the slug we're looking for
    const targetSlug = 'ayecon-academy-1:1-mentorship';
    const targetWhop = await prisma.deal.findFirst({
      where: { slug: targetSlug }
    });
    
    if (targetWhop) {
      console.log(`\n🎯 Target whop with slug "${targetSlug}":`);
      console.log(`   ID: ${targetWhop.id}`);
      console.log(`   Name: ${targetWhop.name}`);
    } else {
      console.log(`\n❌ No whop found with slug "${targetSlug}"`);
    }
    
  } catch (error) {
    console.error('❌ Error finding duplicate Ayecon:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
findDuplicateAyecon();