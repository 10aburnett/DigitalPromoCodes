import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findTrulyMissing() {
  try {
    console.log('🔍 FINDING TRULY MISSING HARDCODED PROMO CODES');
    console.log('===============================================\n');
    
    // All hardcoded promo codes from WhopPageClient.tsx
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
    
    // Get all whops with promo codes from database
    const whopsWithPromos = await prisma.whop.findMany({
      where: {
        PromoCode: {
          some: {}
        }
      },
      select: {
        name: true,
        displayOrder: true
      }
    });
    
    const dbWhopNames = whopsWithPromos.map(w => w.name);
    
    console.log('✅ HARDCODED WHOPS ALREADY IN DATABASE:');
    const alreadyMigrated = [];
    const stillMissing = [];
    
    hardcodedPromos.forEach(hardcodedName => {
      const foundInDb = dbWhopNames.find(dbName => 
        dbName === hardcodedName || 
        dbName.includes(hardcodedName) || 
        hardcodedName.includes(dbName)
      );
      
      if (foundInDb) {
        alreadyMigrated.push({ hardcoded: hardcodedName, database: foundInDb });
      } else {
        stillMissing.push(hardcodedName);
      }
    });
    
    alreadyMigrated.forEach((item, index) => {
      console.log(`${index + 1}. "${item.hardcoded}" → "${item.database}"`);
    });
    
    console.log(`\n❌ HARDCODED WHOPS STILL MISSING FROM DATABASE:`);
    stillMissing.forEach((name, index) => {
      console.log(`${index + 1}. "${name}"`);
    });
    
    // Check if missing whops exist in database without promo codes
    console.log(`\n🔍 CHECKING IF MISSING WHOPS EXIST WITHOUT PROMO CODES...`);
    for (const missingName of stillMissing) {
      const whopExists = await prisma.whop.findFirst({
        where: {
          OR: [
            { name: missingName },
            { name: { contains: missingName.split(' ')[0], mode: 'insensitive' } }
          ]
        },
        include: { PromoCode: true }
      });
      
      if (whopExists) {
        console.log(`   ✅ "${whopExists.name}" exists (ID: ${whopExists.id}, Display: ${whopExists.displayOrder}, Promos: ${whopExists.PromoCode.length})`);
      } else {
        console.log(`   ❌ No match found for "${missingName}"`);
      }
    }
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`- Hardcoded promo codes: ${hardcodedPromos.length}`);
    console.log(`- Already migrated: ${alreadyMigrated.length}`);
    console.log(`- Still missing: ${stillMissing.length}`);
    console.log(`- Current database total: ${whopsWithPromos.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findTrulyMissing();