import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditAllPromoTampering() {
  try {
    console.log('🚨 COMPREHENSIVE AUDIT OF ALL PROMO CODE TAMPERING');
    console.log('==================================================\n');
    
    // EXACT hardcoded promo codes from WhopPageClient.tsx that should be preserved
    const originalHardcodedPromos = [
      { name: 'Josh Exclusive VIP Access', code: 'JOSH' },
      { name: 'Momentum Monthly', code: 'PROMO-1A92969C' },
      { name: 'Larry\'s Lounge Premium', code: 'PROMO-BF9EF1CC' },
      { name: 'Dodgy\'s Dungeon', code: 'PROMO-565022F7' },
      { name: 'Trade With Insight - Pro', code: 'PROMO-624C9EA4' },
      { name: 'ParlayScience Discord Access', code: 'PROMO-C0047AFA' },
      { name: 'Scarface Trades Premium', code: 'PROMO-01FE6235' },
      { name: 'The Haven', code: 'PROMO-45EF5D24' },
      { name: 'PropFellas VIP', code: 'PROMO-B83DC955' },
      { name: 'Owls Full Access', code: 'PROMO-7136BFC8' },
      { name: 'Stellar AIO', code: 'PROMO-1A6008FA' },
      { name: 'Goat Ecom Growth', code: 'PROMO-1B868367' },
      { name: 'Indicators & VIP | LIFETIME', code: 'PROMO-7DBFEB18' },
      { name: 'Supercar Income', code: 'PROMO-5E906FAB' },
      { name: 'GOAT Sports Bets Membership', code: 'PROMO-3352BB19' },
      { name: 'Best Of Both Worlds', code: 'PROMO-336B4ACD' },
      { name: 'Moementum University', code: 'PROMO-23AB3618' },
      { name: 'ZWM Lifetime Access', code: 'PROMO-4E6D572F' },
      { name: 'Ayecon Academy Lifetime Membership', code: 'PROMO-022D1F18' },
      { name: 'The BFI Traders University', code: 'PROMO-58B279FF' }
    ];
    
    // Get all whops with promo codes from database
    const allWhopsWithPromos = await prisma.whop.findMany({
      where: {
        PromoCode: {
          some: {}
        }
      },
      include: {
        PromoCode: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log('🔍 CHECKING FOR PROMO CODE TAMPERING...\n');
    
    const tamperedCodes = [];
    const correctCodes = [];
    const unknownCodes = [];
    
    for (const hardcodedPromo of originalHardcodedPromos) {
      const dbWhop = allWhopsWithPromos.find(w => w.name === hardcodedPromo.name);
      
      if (dbWhop && dbWhop.PromoCode.length > 0) {
        const dbPromoCode = dbWhop.PromoCode[0].code; // Get first promo code
        
        if (dbPromoCode === hardcodedPromo.code) {
          correctCodes.push({
            whop: hardcodedPromo.name,
            code: dbPromoCode,
            status: '✅ CORRECT'
          });
        } else {
          tamperedCodes.push({
            whop: hardcodedPromo.name,
            originalCode: hardcodedPromo.code,
            currentCode: dbPromoCode,
            status: '🚨 TAMPERED'
          });
        }
      }
    }
    
    // Also check for any database promo codes that don't match known hardcoded ones
    for (const dbWhop of allWhopsWithPromos) {
      const isKnownHardcoded = originalHardcodedPromos.some(h => h.name === dbWhop.name);
      
      if (!isKnownHardcoded) {
        dbWhop.PromoCode.forEach(promo => {
          unknownCodes.push({
            whop: dbWhop.name,
            code: promo.code,
            status: '❓ DATABASE ONLY'
          });
        });
      }
    }
    
    console.log('🚨 TAMPERED PROMO CODES (NEED IMMEDIATE FIX):');
    if (tamperedCodes.length === 0) {
      console.log('   ✅ No tampered codes found');
    } else {
      tamperedCodes.forEach((item, index) => {
        console.log(`${index + 1}. "${item.whop}"`);
        console.log(`   Original: ${item.originalCode}`);
        console.log(`   Current:  ${item.currentCode} ❌`);
        console.log('');
      });
    }
    
    console.log('✅ CORRECT PROMO CODES:');
    correctCodes.forEach((item, index) => {
      console.log(`${index + 1}. "${item.whop}" - ${item.code}`);
    });
    
    console.log('\n❓ DATABASE-ONLY PROMO CODES (NOT HARDCODED):');
    unknownCodes.forEach((item, index) => {
      console.log(`${index + 1}. "${item.whop}" - ${item.code}`);
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`- Tampered codes: ${tamperedCodes.length} 🚨`);
    console.log(`- Correct codes: ${correctCodes.length} ✅`);
    console.log(`- Database-only codes: ${unknownCodes.length} ❓`);
    
    if (tamperedCodes.length > 0) {
      console.log(`\n🚨 CRITICAL: ${tamperedCodes.length} promo codes have been tampered with and need immediate restoration!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditAllPromoTampering();