const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAyeconPromoCodes() {
  try {
    console.log('🔍 Debugging Ayecon Academy promo codes...');
    
    // Find the Ayecon Academy whop by slug
    const whop = await prisma.whop.findFirst({
      where: { 
        slug: 'ayecon-academy-1:1-mentorship'
      }
    });
    
    if (!whop) {
      console.log('❌ Whop not found with slug: ayecon-academy-1:1-mentorship');
      return;
    }
    
    console.log(`✅ Found whop: ${whop.name} (ID: ${whop.id})`);
    
    // Find all promo codes for this whop
    const allPromoCodes = await prisma.promoCode.findMany({
      where: { whopId: whop.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📦 All promo codes for this whop (${allPromoCodes.length} total):`);
    allPromoCodes.forEach((promo, index) => {
      console.log(`  ${index + 1}. ${promo.id} - "${promo.title}" (${promo.code})`);
    });
    
    // Find community promo codes specifically
    const communityPromoCodes = await prisma.promoCode.findMany({
      where: {
        whopId: whop.id,
        id: { startsWith: 'community_' }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n🏘️  Community promo codes (${communityPromoCodes.length} total):`);
    communityPromoCodes.forEach((promo, index) => {
      console.log(`  ${index + 1}. ${promo.id} - "${promo.title}" (${promo.code})`);
    });
    
    // Find non-community promo codes
    const originalPromoCodes = allPromoCodes.filter(code => !code.id.startsWith('community_'));
    
    console.log(`\n📜 Original promo codes (${originalPromoCodes.length} total):`);
    originalPromoCodes.forEach((promo, index) => {
      console.log(`  ${index + 1}. ${promo.id} - "${promo.title}" (${promo.code})`);
    });
    
    // Check promo code submissions for this whop
    const submissions = await prisma.promoCodeSubmission.findMany({
      where: { whopId: whop.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📝 Promo code submissions for this whop (${submissions.length} total):`);
    submissions.forEach((submission, index) => {
      console.log(`  ${index + 1}. ${submission.id} - "${submission.title}" - ${submission.status} (${submission.code})`);
    });
    
  } catch (error) {
    console.error('❌ Error debugging Ayecon promo codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
debugAyeconPromoCodes();