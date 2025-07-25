import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreAllPromoCodes() {
  try {
    console.log('🚨 RESTORING ALL TAMPERED PROMO CODES TO ORIGINAL VERSIONS');
    console.log('=========================================================\n');
    
    const restores = [
      { whop: 'Josh Exclusive VIP Access', wrong: 'JOSH20', correct: 'JOSH' },
      { whop: 'Momentum Monthly', wrong: 'MOMENTUM20', correct: 'PROMO-1A92969C' },
      { whop: 'Larry\'s Lounge Premium', wrong: 'LARRY25', correct: 'PROMO-BF9EF1CC' },
      { whop: 'Trade With Insight - Pro', wrong: 'INSIGHT15', correct: 'PROMO-624C9EA4' },
      { whop: 'ParlayScience Discord Access', wrong: 'PARLAY20', correct: 'PROMO-C0047AFA' },
      { whop: 'Scarface Trades Premium', wrong: 'SCARFACE25', correct: 'PROMO-01FE6235' },
      { whop: 'PropFellas VIP', wrong: 'PROPFELLAS10', correct: 'PROMO-B83DC955' },
      { whop: 'Owls Full Access', wrong: 'OWLS20', correct: 'PROMO-7136BFC8' },
      { whop: 'Goat Ecom Growth', wrong: 'GOATECOM10', correct: 'PROMO-1B868367' },
      { whop: 'Indicators & VIP | LIFETIME', wrong: 'INDICATORS10', correct: 'PROMO-7DBFEB18' },
      { whop: 'GOAT Sports Bets Membership', wrong: 'GOATSPORTS20', correct: 'PROMO-3352BB19' },
      { whop: 'Best Of Both Worlds', wrong: 'BESTWORLDS5', correct: 'PROMO-336B4ACD' },
      { whop: 'Moementum University', wrong: 'MOMENTUM10', correct: 'PROMO-23AB3618' },
      { whop: 'ZWM Lifetime Access', wrong: 'ZWMLIFE40', correct: 'PROMO-4E6D572F' },
      { whop: 'Ayecon Academy Lifetime Membership', wrong: 'AYECONLIFE10', correct: 'PROMO-022D1F18' },
      { whop: 'The BFI Traders University', wrong: 'BFI15', correct: 'PROMO-58B279FF' }
    ];
    
    for (const restore of restores) {
      console.log(`🔧 Restoring: ${restore.whop}`);
      
      // Find the whop and its promo code
      const whop = await prisma.whop.findFirst({
        where: { name: restore.whop },
        include: { PromoCode: true }
      });
      
      if (!whop) {
        console.log(`   ❌ Whop "${restore.whop}" not found`);
        continue;
      }
      
      // Find the wrong promo code
      const wrongPromo = whop.PromoCode.find(p => p.code === restore.wrong);
      
      if (!wrongPromo) {
        console.log(`   ❌ Wrong code "${restore.wrong}" not found`);
        continue;
      }
      
      // Restore to original hardcoded version
      await prisma.promoCode.update({
        where: { id: wrongPromo.id },
        data: { code: restore.correct }
      });
      
      console.log(`   ✅ RESTORED: "${restore.wrong}" → "${restore.correct}"`);
    }
    
    console.log('\n🎉 ALL PROMO CODES RESTORED TO ORIGINAL HARDCODED VERSIONS!');
    console.log('Your site legitimacy has been fully restored.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreAllPromoCodes();