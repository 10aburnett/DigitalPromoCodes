const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCommunityPromoIds() {
  try {
    console.log('🔍 Finding promo codes that should have community_ prefix...');
    
    // Find all promo code submissions that were approved
    const approvedSubmissions = await prisma.promoCodeSubmission.findMany({
      where: {
        status: 'APPROVED',
        whopId: { not: null }
      },
      include: {
        whop: true
      }
    });
    
    console.log(`Found ${approvedSubmissions.length} approved submissions`);
    
    for (const submission of approvedSubmissions) {
      // Check if a promo code exists with the expected community_ prefix
      const expectedId = `community_${submission.id}`;
      const existingCommunityCode = await prisma.promoCode.findUnique({
        where: { id: expectedId }
      });
      
      if (existingCommunityCode) {
        console.log(`✅ Promo code ${expectedId} already has correct prefix`);
        continue;
      }
      
      // Look for promo codes that match the submission details but don't have the prefix
      const matchingPromoCodes = await prisma.promoCode.findMany({
        where: {
          whopId: submission.whopId,
          title: submission.title,
          code: submission.code,
          value: submission.value,
          NOT: {
            id: { startsWith: 'community_' }
          }
        }
      });
      
      if (matchingPromoCodes.length > 0) {
        for (const promoCode of matchingPromoCodes) {
          console.log(`🔧 Found promo code ${promoCode.id} that should have community_ prefix`);
          console.log(`   Title: ${promoCode.title}`);
          console.log(`   Code: ${promoCode.code}`);
          console.log(`   Whop: ${submission.whop?.name}`);
          
          // Create new promo code with community_ prefix
          try {
            await prisma.promoCode.create({
              data: {
                id: expectedId,
                title: promoCode.title,
                description: promoCode.description,
                code: promoCode.code,
                type: promoCode.type,
                value: promoCode.value,
                whopId: promoCode.whopId,
                createdAt: promoCode.createdAt,
                updatedAt: new Date()
              }
            });
            
            console.log(`✅ Created new promo code with ID: ${expectedId}`);
            
            // Delete the old promo code
            await prisma.promoCode.delete({
              where: { id: promoCode.id }
            });
            
            console.log(`🗑️  Deleted old promo code: ${promoCode.id}`);
            
          } catch (error) {
            console.error(`❌ Error updating promo code ${promoCode.id}:`, error.message);
          }
        }
      } else {
        console.log(`⚠️  No matching promo code found for submission ${submission.id} (${submission.title})`);
      }
    }
    
    console.log('✅ Community promo code ID fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing community promo IDs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixCommunityPromoIds();