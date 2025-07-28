import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdditionalPromoCodes() {
  try {
    console.log('🔧 FIXING ADDITIONAL PROMO CODES TO CORRECT VERSIONS');
    console.log('===================================================\n');
    
    const additionalFixes = [
      {
        whopName: 'Dodgy\'s Ultimate Course',
        wrongCode: 'DODGY30',
        correctCode: 'PROMO-565022F7',
        discount: '15'
      },
      {
        whopName: 'The Haven (Pay with Crypto)',
        wrongCode: 'HAVEN10', 
        correctCode: 'PROMO-45EF5D24',
        discount: '10'
      },
      {
        whopName: 'Stellar AIO 3rd Instance',
        wrongCode: 'STELLAR20',
        correctCode: 'PROMO-1A6008FA',
        discount: '20'
      }
    ];
    
    for (const fix of additionalFixes) {
      console.log(`🔍 Fixing: ${fix.whopName}`);
      
      // Find the whop and its promo code
      const whop = await prisma.whop.findFirst({
        where: { name: fix.whopName },
        include: { PromoCode: true }
      });
      
      if (!whop) {
        console.log(`   ❌ Whop "${fix.whopName}" not found`);
        continue;
      }
      
      // Find the wrong promo code
      const wrongPromo = whop.PromoCode.find(p => p.code === fix.wrongCode);
      
      if (!wrongPromo) {
        console.log(`   ❌ Wrong code "${fix.wrongCode}" not found`);
        continue;
      }
      
      // Update the promo code and discount value
      await prisma.promoCode.update({
        where: { id: wrongPromo.id },
        data: { 
          code: fix.correctCode,
          value: fix.discount
        }
      });
      
      console.log(`   ✅ Fixed: "${fix.wrongCode}" → "${fix.correctCode}" (${fix.discount}% off)`);
    }
    
    console.log('\n🎉 ALL ADDITIONAL PROMO CODES FIXED!');
    console.log('All promo codes now match the correct versions you specified.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdditionalPromoCodes();