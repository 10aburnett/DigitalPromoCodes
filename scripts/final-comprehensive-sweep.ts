import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalComprehensiveSweep() {
  try {
    console.log('🔍 FINAL COMPREHENSIVE SWEEP - CHECKING ALL PROMO CODES');
    console.log('========================================================\n');
    
    // ALL legitimate promo codes you have provided throughout our conversation
    const allLegitimatePromoCodes = [
      // Original hardcoded promo codes from WhopPageClient.tsx
      { whop: 'Josh Exclusive VIP Access', code: 'JOSH', source: 'hardcoded' },
      { whop: 'Momentum Monthly', code: 'PROMO-1A92969C', source: 'hardcoded' },
      { whop: 'Larry\'s Lounge Premium', code: 'PROMO-BF9EF1CC', source: 'hardcoded' },
      { whop: 'Dodgy\'s Dungeon', code: 'PROMO-565022F7', source: 'hardcoded' },
      { whop: 'Trade With Insight - Pro', code: 'PROMO-624C9EA4', source: 'hardcoded' },
      { whop: 'ParlayScience Discord Access', code: 'PROMO-C0047AFA', source: 'hardcoded' },
      { whop: 'Scarface Trades Premium', code: 'PROMO-01FE6235', source: 'hardcoded' },
      { whop: 'The Haven', code: 'PROMO-45EF5D24', source: 'hardcoded' },
      { whop: 'PropFellas VIP', code: 'PROMO-B83DC955', source: 'hardcoded' },
      { whop: 'Owls Full Access', code: 'PROMO-7136BFC8', source: 'hardcoded' },
      { whop: 'Stellar AIO', code: 'PROMO-1A6008FA', source: 'hardcoded' },
      { whop: 'Goat Ecom Growth', code: 'PROMO-1B868367', source: 'hardcoded' },
      { whop: 'Indicators & VIP | LIFETIME', code: 'PROMO-7DBFEB18', source: 'hardcoded' },
      { whop: 'Supercar Income', code: 'PROMO-5E906FAB', source: 'hardcoded' },
      { whop: 'GOAT Sports Bets Membership', code: 'PROMO-3352BB19', source: 'hardcoded' },
      { whop: 'Best Of Both Worlds', code: 'PROMO-336B4ACD', source: 'hardcoded' },
      { whop: 'Moementum University', code: 'PROMO-23AB3618', source: 'hardcoded' },
      { whop: 'ZWM Lifetime Access', code: 'PROMO-4E6D572F', source: 'hardcoded' },
      { whop: 'Ayecon Academy Lifetime Membership', code: 'PROMO-022D1F18', source: 'hardcoded' },
      { whop: 'The BFI Traders University', code: 'PROMO-58B279FF', source: 'hardcoded' },
      
      // Additional promo codes you specified
      { whop: 'Dodgy\'s Ultimate Course', code: 'PROMO-565022F7', source: 'user specified' },
      { whop: 'The Haven (Pay with Crypto)', code: 'PROMO-45EF5D24', source: 'user specified' },
      { whop: 'Stellar AIO 3rd Instance', code: 'PROMO-1A6008FA', source: 'user specified' },
      
      // TMS promo codes you provided in updates
      { whop: 'TMS (#1 ON WHOP)', code: '7DAYSFOR1', source: 'user provided TMS update' },
      { whop: 'TMS Player Props 📊', code: '7DAYSFOR1', source: 'user provided TMS update' },
      { whop: 'TMS+ (Heavy Hitters) 💎', code: '7DAYSFOR1', source: 'user provided TMS update' },
      { whop: 'TMS Exclusive VIP Chat', code: 'PROMO-327DB8FC', source: 'user provided TMS update' },
      { whop: 'TMS Spartan AI Bot', code: 'PROMO-327DB8FC', source: 'user provided TMS update' },
      
      // Other legitimate codes you provided
      { whop: 'ZWM Gold', code: 'PROMO-73841533', source: 'user provided update' },
      { whop: 'PJ Trades Premium', code: 'PROMO-1EDC4580', source: 'user provided update' },
      { whop: 'The Delta Vader - Copy Tader', code: 'PROMO-7DBFEB18', source: 'user provided update' },
      { whop: 'Supercar Income Broker', code: 'SUPERCAR5', source: 'existing database' },
      
      // Ayecon codes that were pre-existing
      { whop: 'Ayecon Academy 1:1 Mentorship', code: 'summertime', source: 'pre-existing' },
      { whop: 'Ayecon Academy Monthly Mentorship', code: 'summertime', source: 'pre-existing' }
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
    
    console.log('🔍 COMPREHENSIVE VERIFICATION OF ALL PROMO CODES...\n');
    
    const correctCodes = [];
    const suspiciousCodes = [];
    const unknownCodes = [];
    
    // Check every promo code in the database
    for (const dbWhop of allWhopsWithPromos) {
      for (const dbPromo of dbWhop.PromoCode) {
        const legitMatch = allLegitimatePromoCodes.find(legit => 
          legit.whop === dbWhop.name && legit.code === dbPromo.code
        );
        
        if (legitMatch) {
          correctCodes.push({
            whop: dbWhop.name,
            code: dbPromo.code,
            source: legitMatch.source,
            status: '✅ LEGITIMATE'
          });
        } else {
          // Check if whop has legitimate code but wrong one
          const whopShouldHave = allLegitimatePromoCodes.find(legit => legit.whop === dbWhop.name);
          
          if (whopShouldHave) {
            suspiciousCodes.push({
              whop: dbWhop.name,
              actualCode: dbPromo.code,
              expectedCode: whopShouldHave.code,
              status: '🚨 WRONG CODE'
            });
          } else {
            unknownCodes.push({
              whop: dbWhop.name,
              code: dbPromo.code,
              status: '❓ UNKNOWN/UNVERIFIED'
            });
          }
        }
      }
    }
    
    console.log('✅ LEGITIMATE PROMO CODES:');
    correctCodes.forEach((item, index) => {
      console.log(`${index + 1}. "${item.whop}" - ${item.code} (${item.source})`);
    });
    
    if (suspiciousCodes.length > 0) {
      console.log('\n🚨 SUSPICIOUS/WRONG PROMO CODES:');
      suspiciousCodes.forEach((item, index) => {
        console.log(`${index + 1}. "${item.whop}"`);
        console.log(`   Actual:   ${item.actualCode} ❌`);
        console.log(`   Expected: ${item.expectedCode} ✅`);
      });
    }
    
    if (unknownCodes.length > 0) {
      console.log('\n❓ UNKNOWN/UNVERIFIED PROMO CODES:');
      unknownCodes.forEach((item, index) => {
        console.log(`${index + 1}. "${item.whop}" - ${item.code}`);
      });
    }
    
    console.log(`\n📊 FINAL SWEEP SUMMARY:`);
    console.log(`- Legitimate codes: ${correctCodes.length} ✅`);
    console.log(`- Wrong codes: ${suspiciousCodes.length} 🚨`);
    console.log(`- Unknown/unverified codes: ${unknownCodes.length} ❓`);
    console.log(`- Total promo codes checked: ${correctCodes.length + suspiciousCodes.length + unknownCodes.length}`);
    
    if (suspiciousCodes.length === 0) {
      console.log('\n🎉 PERFECT: All promo codes match your specifications!');
    } else {
      console.log('\n🚨 ISSUES FOUND: Some promo codes need correction!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalComprehensiveSweep();