import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function completePromoAudit() {
  try {
    console.log('🔍 COMPLETE PROMO CODE AUDIT');
    console.log('=============================\n');
    
    // Step 1: Extract all hardcoded promo codes from WhopPageClient.tsx
    const hardcodedPromos = [
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
    
    console.log(`📋 HARDCODED PROMO CODES FOUND: ${hardcodedPromos.length}`);
    hardcodedPromos.forEach((promo, index) => {
      console.log(`${index + 1}. "${promo.name}" - ${promo.code}`);
    });
    
    console.log(`\n🗄️ CHECKING DATABASE...`);
    
    // Step 2: Get all whops with promo codes from database
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
        displayOrder: 'asc'
      }
    });
    
    console.log(`📊 DATABASE PROMO CODES FOUND: ${whopsWithDbPromos.length} whops`);
    
    // Step 3: Cross-reference
    const migratedWhops = [];
    const missingWhops = [];
    
    for (const hardcodedPromo of hardcodedPromos) {
      const foundInDb = whopsWithDbPromos.find(dbWhop => 
        dbWhop.name === hardcodedPromo.name
      );
      
      if (foundInDb) {
        migratedWhops.push({
          name: hardcodedPromo.name,
          hardcodedCode: hardcodedPromo.code,
          dbCodes: foundInDb.PromoCode.map(pc => pc.code),
          displayOrder: foundInDb.displayOrder
        });
      } else {
        missingWhops.push(hardcodedPromo);
      }
    }
    
    console.log(`\n✅ ALREADY MIGRATED: ${migratedWhops.length} whops`);
    migratedWhops.forEach((whop, index) => {
      console.log(`${index + 1}. [${whop.displayOrder}] "${whop.name}"`);
      console.log(`   Hardcoded: ${whop.hardcodedCode}`);
      console.log(`   Database: ${whop.dbCodes.join(', ')}`);
    });
    
    console.log(`\n❌ MISSING FROM DATABASE: ${missingWhops.length} whops`);
    missingWhops.forEach((whop, index) => {
      console.log(`${index + 1}. "${whop.name}" - ${whop.code}`);
    });
    
    // Step 4: Check if any whops exist in DB but don't have promo codes
    console.log(`\n🔍 CHECKING IF MISSING WHOPS EXIST IN DATABASE...`);
    for (const missingWhop of missingWhops) {
      const whopExists = await prisma.whop.findFirst({
        where: {
          name: missingWhop.name
        }
      });
      
      if (whopExists) {
        console.log(`   ✓ "${missingWhop.name}" exists (ID: ${whopExists.id}, Display: ${whopExists.displayOrder})`);
      } else {
        console.log(`   ✗ "${missingWhop.name}" NOT FOUND in database`);
      }
    }
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`- Total hardcoded promo codes: ${hardcodedPromos.length}`);
    console.log(`- Already migrated: ${migratedWhops.length}`);
    console.log(`- Missing from database: ${missingWhops.length}`);
    console.log(`- Need to migrate: ${missingWhops.length} promo codes`);
    
    if (missingWhops.length > 0) {
      console.log(`\n⚠️  NEXT STEPS:`);
      console.log(`1. Migrate ${missingWhops.length} missing promo codes to database`);
      console.log(`2. Update displayOrder for all ${hardcodedPromos.length} whops to top 40 positions`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completePromoAudit();