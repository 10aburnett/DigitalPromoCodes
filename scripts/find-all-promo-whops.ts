import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAllPromoWhops() {
  try {
    console.log('🔍 FINDING ALL WHOPS WITH PROMO CODES (COMPREHENSIVE)');
    console.log('===================================================\n');
    
    // All hardcoded promo codes from WhopPageClient.tsx with EXACT names
    const hardcodedPromos = [
      'Josh Exclusive VIP Access',
      'Momentum Monthly', 
      'Larry\'s Lounge Premium',
      'Dodgy\'s Dungeon',
      'Trade With Insight - Pro',
      'ParlayScience Discord Access',
      'Scarface Trades Premium',
      'The Haven',
      'PropFellas VIP',
      'Owls Full Access',
      'Stellar AIO',
      'Goat Ecom Growth',
      'Indicators & VIP | LIFETIME',
      'Supercar Income',
      'GOAT Sports Bets Membership',
      'Best Of Both Worlds',
      'Moementum University',
      'ZWM Lifetime Access',
      'Ayecon Academy Lifetime Membership',
      'The BFI Traders University'
    ];
    
    console.log(`📋 HARDCODED PROMO WHOPS: ${hardcodedPromos.length}`);
    hardcodedPromos.forEach((name, index) => {
      console.log(`${index + 1}. "${name}"`);
    });
    
    // Get all whops with promo codes from database
    const whopsWithDbPromos = await prisma.whop.findMany({
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
    
    console.log(`\n🗄️ DATABASE PROMO WHOPS: ${whopsWithDbPromos.length}`);
    whopsWithDbPromos.forEach((whop, index) => {
      console.log(`${index + 1}. "${whop.name}"`);
    });
    
    // Find hardcoded whops that exist in database  
    console.log(`\n🔍 CHECKING EACH HARDCODED WHOP IN DATABASE...`);
    const foundInDb = [];
    const notFoundInDb = [];
    
    for (const hardcodedName of hardcodedPromos) {
      const exactMatch = whopsWithDbPromos.find(dbWhop => dbWhop.name === hardcodedName);
      
      if (exactMatch) {
        foundInDb.push({ hardcoded: hardcodedName, database: exactMatch.name });
        console.log(`✅ "${hardcodedName}" → FOUND as "${exactMatch.name}"`);
      } else {
        notFoundInDb.push(hardcodedName);
        console.log(`❌ "${hardcodedName}" → NOT FOUND in database`);
      }
    }
    
    // Check if missing hardcoded whops exist with different names
    console.log(`\n🔍 SEARCHING FOR MISSING HARDCODED WHOPS WITH SIMILAR NAMES...`);
    for (const missingName of notFoundInDb) {
      const allWhops = await prisma.whop.findMany({
        where: {
          name: {
            contains: missingName.split(' ')[0],
            mode: 'insensitive'
          }
        },
        include: { PromoCode: true }
      });
      
      console.log(`🔍 "${missingName}" - Found ${allWhops.length} similar whops:`);
      allWhops.forEach(whop => {
        console.log(`   - "${whop.name}" (${whop.PromoCode.length} promo codes)`);
      });
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`- Hardcoded promo whops: ${hardcodedPromos.length}`);
    console.log(`- Database promo whops: ${whopsWithDbPromos.length}`);  
    console.log(`- Hardcoded found in DB: ${foundInDb.length}`);
    console.log(`- Hardcoded NOT found in DB: ${notFoundInDb.length}`);
    
    // Calculate TRUE total
    const dbOnlyWhops = whopsWithDbPromos.filter(dbWhop => 
      !hardcodedPromos.includes(dbWhop.name)
    );
    
    console.log(`- Database-only promo whops: ${dbOnlyWhops.length}`);
    console.log(`\n🔥 ESTIMATED TOTAL WHEN ALL HARDCODED ARE ADDED:`);
    console.log(`${whopsWithDbPromos.length} (current DB) + ${notFoundInDb.length} (missing hardcoded) = ${whopsWithDbPromos.length + notFoundInDb.length} whops with promo codes`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findAllPromoWhops();