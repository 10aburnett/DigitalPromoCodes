import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDodgyWhops() {
  try {
    console.log('🔍 SEARCHING FOR ALL DODGY WHOPS');
    console.log('===============================\n');
    
    // Find all whops with "dodgy" in the name
    const dodgyWhops = await prisma.whop.findMany({
      where: {
        name: {
          contains: 'Dodgy',
          mode: 'insensitive'
        }
      },
      include: {
        PromoCode: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`📊 Found ${dodgyWhops.length} whops with "Dodgy" in the name:`);
    dodgyWhops.forEach((whop, index) => {
      console.log(`${index + 1}. "${whop.name}" (ID: ${whop.id})`);
      console.log(`   Display Order: ${whop.displayOrder}`);
      console.log(`   Promo Codes: ${whop.PromoCode.length}`);
      if (whop.PromoCode.length > 0) {
        whop.PromoCode.forEach(promo => {
          console.log(`     - ${promo.code}: ${promo.value}% off (${promo.title})`);
        });
      }
      console.log('');
    });
    
    // Check which one needs the hardcoded promo code
    const hardcodedName = "Dodgy's Dungeon";
    const exactMatch = dodgyWhops.find(w => w.name === hardcodedName);
    
    if (exactMatch) {
      console.log(`✅ Exact match found: "${exactMatch.name}"`);
    } else {
      console.log(`❌ No exact match for "${hardcodedName}"`);
      console.log(`🔍 Available options:`);
      dodgyWhops.forEach((whop, index) => {
        console.log(`   ${index + 1}. "${whop.name}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDodgyWhops();