const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanUpInappropriatePromos() {
  try {
    console.log('🧹 CLEANING UP INAPPROPRIATE FAKE PROMO CODES\n');

    // Generic/static-like page names that shouldn't have fake promos
    const genericPageNames = [
      'Academy', 'Access', 'VIP', 'Premium', 'Member', 
      'Trading', 'Hero', 'Discord', 'Exclusive', 
      'Membership', 'CREATOR', 'TRADING ROOM'
    ];

    console.log('🔍 Checking for recently added fake promos on generic pages...');

    // Find recently created promos (last 2 hours) on generic pages
    const recentDate = new Date(Date.now() - 2*60*60*1000);
    
    for (const pageName of genericPageNames) {
      const page = await prisma.whop.findFirst({
        where: { name: pageName },
        select: {
          id: true,
          name: true,
          slug: true,
          PromoCode: {
            where: {
              createdAt: { gte: recentDate }
            },
            select: {
              id: true,
              code: true,
              value: true,
              createdAt: true
            }
          }
        }
      });

      if (page && page.PromoCode.length > 0) {
        console.log(`\n❌ Found inappropriate fake promos on "${page.name}":`);
        
        for (const promo of page.PromoCode) {
          console.log(`   • ${promo.code} (${promo.value}% off) - Created: ${promo.createdAt}`);
          
          // Check if this looks like a fake promo (generic codes)
          const fakePromoCodes = ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15', 'LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10', 'DISCOUNT30', 'OFF20', 'DEAL35', 'PROMO40'];
          
          if (fakePromoCodes.includes(promo.code)) {
            console.log(`     🗑️ Removing fake promo: ${promo.code}`);
            await prisma.promoCode.delete({
              where: { id: promo.id }
            });
            console.log(`     ✅ Removed`);
          }
        }
      }
    }

    // Also check if these generic pages are actually legitimate course pages
    console.log('\n🔍 Let me check what these "generic" pages actually are...');
    
    for (const pageName of genericPageNames) {
      const page = await prisma.whop.findFirst({
        where: { name: pageName },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          website: true,
          PromoCode: {
            select: {
              id: true,
              code: true,
              createdAt: true
            }
          }
        }
      });

      if (page) {
        const isLegitimate = page.description && page.description.length > 50;
        const hasOldPromos = page.PromoCode.some(promo => 
          new Date(promo.createdAt) < recentDate
        );
        
        console.log(`\n📄 "${page.name}":`);
        console.log(`   Slug: ${page.slug}`);
        console.log(`   Description length: ${page.description?.length || 0} chars`);
        console.log(`   Website: ${page.website || 'None'}`);
        console.log(`   Seems legitimate: ${isLegitimate ? '✅' : '❌'}`);
        console.log(`   Had original promos: ${hasOldPromos ? '✅' : '❌'}`);
        console.log(`   Remaining promos: ${page.PromoCode.length}`);
      }
    }

    // Final count
    const finalCount = await prisma.whop.count({
      where: {
        indexing: 'INDEX',
        PromoCode: {
          some: {}
        }
      }
    });

    console.log(`\n📊 FINAL STATUS:`);
    console.log(`   Indexed pages with promo codes: ${finalCount}/60`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanUpInappropriatePromos();