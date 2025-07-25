import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalLegitimacyAudit() {
  try {
    console.log('🔍 FINAL LEGITIMACY AUDIT - VERIFYING ALL PROMO CODES ARE USER-PROVIDED');
    console.log('======================================================================\n');
    
    // EXACT promo codes from hardcoded WhopPageClient.tsx - these are the ONLY legitimate ones
    const userProvidedPromoCodes = [
      { whop: 'Josh Exclusive VIP Access', code: 'JOSH' },
      { whop: 'Momentum Monthly', code: 'PROMO-1A92969C' },
      { whop: 'Larry\'s Lounge Premium', code: 'PROMO-BF9EF1CC' },
      { whop: 'Dodgy\'s Dungeon', code: 'PROMO-565022F7' },
      { whop: 'Trade With Insight - Pro', code: 'PROMO-624C9EA4' },
      { whop: 'ParlayScience Discord Access', code: 'PROMO-C0047AFA' },
      { whop: 'Scarface Trades Premium', code: 'PROMO-01FE6235' },
      { whop: 'The Haven', code: 'PROMO-45EF5D24' },
      { whop: 'PropFellas VIP', code: 'PROMO-B83DC955' },
      { whop: 'Owls Full Access', code: 'PROMO-7136BFC8' },
      { whop: 'Stellar AIO', code: 'PROMO-1A6008FA' },
      { whop: 'Goat Ecom Growth', code: 'PROMO-1B868367' },
      { whop: 'Indicators & VIP | LIFETIME', code: 'PROMO-7DBFEB18' },
      { whop: 'Supercar Income', code: 'PROMO-5E906FAB' },
      { whop: 'GOAT Sports Bets Membership', code: 'PROMO-3352BB19' },
      { whop: 'Best Of Both Worlds', code: 'PROMO-336B4ACD' },
      { whop: 'Moementum University', code: 'PROMO-23AB3618' },
      { whop: 'ZWM Lifetime Access', code: 'PROMO-4E6D572F' },
      { whop: 'Ayecon Academy Lifetime Membership', code: 'PROMO-022D1F18' },
      { whop: 'The BFI Traders University', code: 'PROMO-58B279FF' }
    ];
    
    // Get ALL whops with promo codes from database
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
    
    console.log('✅ LEGITIMATE USER-PROVIDED HARDCODED PROMO CODES:');
    const legitCodes = [];
    const madeUpCodes = [];
    const databaseOnlyCodes = [];
    
    // Check hardcoded promo codes
    for (const userPromo of userProvidedPromoCodes) {
      const dbWhop = allWhopsWithPromos.find(w => w.name === userPromo.whop);
      
      if (dbWhop && dbWhop.PromoCode.length > 0) {
        const dbCode = dbWhop.PromoCode[0].code;
        
        if (dbCode === userPromo.code) {
          legitCodes.push({
            whop: userPromo.whop,
            code: dbCode,
            source: 'USER PROVIDED (hardcoded)'
          });
          console.log(`✅ "${userPromo.whop}" - ${dbCode}`);
        } else {
          madeUpCodes.push({
            whop: userPromo.whop,
            expected: userPromo.code,
            actual: dbCode,
            source: 'TAMPERED - NOT USER PROVIDED'
          });
          console.log(`🚨 "${userPromo.whop}" - EXPECTED: ${userPromo.code}, ACTUAL: ${dbCode} ❌`);
        }
      }
    }
    
    console.log('\n❓ DATABASE-ONLY PROMO CODES (need to verify legitimacy):');
    // Check database-only codes
    for (const dbWhop of allWhopsWithPromos) {
      const isHardcoded = userProvidedPromoCodes.some(h => h.whop === dbWhop.name);
      
      if (!isHardcoded) {
        dbWhop.PromoCode.forEach(promo => {
          databaseOnlyCodes.push({
            whop: dbWhop.name,
            code: promo.code,
            source: 'DATABASE ONLY - verify legitimacy'
          });
          console.log(`❓ "${dbWhop.name}" - ${promo.code} (verify this is legitimate)`);
        });
      }
    }
    
    if (madeUpCodes.length > 0) {
      console.log('\n🚨 MADE UP / TAMPERED CODES (CRITICAL ISSUE):');
      madeUpCodes.forEach((item, index) => {
        console.log(`${index + 1}. "${item.whop}"`);
        console.log(`   Expected: ${item.expected}`);
        console.log(`   Actual:   ${item.actual} ❌`);
      });
    }
    
    console.log('\n📊 FINAL LEGITIMACY SUMMARY:');
    console.log(`- Legitimate user-provided codes: ${legitCodes.length} ✅`);
    console.log(`- Made up/tampered codes: ${madeUpCodes.length} 🚨`);
    console.log(`- Database-only codes (need verification): ${databaseOnlyCodes.length} ❓`);
    
    if (madeUpCodes.length === 0) {
      console.log('\n🎉 SUCCESS: All hardcoded promo codes match user-provided versions!');
    } else {
      console.log('\n🚨 CRITICAL: Some promo codes are still tampered/made up!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalLegitimacyAudit();