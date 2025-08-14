import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPromoCodes() {
  try {
    console.log('🔧 FIXING PROMO CODES TO MATCH HARDCODED VERSIONS');
    console.log('=================================================\n');
    
    const fixes = [
      {
        whopName: 'Stellar AIO',
        wrongCode: 'STELLAR15',
        correctCode: 'PROMO-1A6008FA'
      },
      {
        whopName: 'The Haven',
        wrongCode: 'HAVEN15', 
        correctCode: 'PROMO-45EF5D24'
      },
      {
        whopName: 'Supercar Income',
        wrongCode: 'SUPERCAR20',
        correctCode: 'PROMO-5E906FAB'
      }
    ];
    
    for (const fix of fixes) {
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
      
      // Update the promo code to the correct hardcoded version
      await prisma.promoCode.update({
        where: { id: wrongPromo.id },
        data: { code: fix.correctCode }
      });
      
      console.log(`   ✅ Fixed: "${fix.wrongCode}" → "${fix.correctCode}"`);
    }
    
    console.log('\n🎉 ALL PROMO CODES FIXED!');
    console.log('Users will now see the correct hardcoded promo codes they expect.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPromoCodes();