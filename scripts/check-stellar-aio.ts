import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStellarAIO() {
  try {
    console.log('🔍 Searching for Stellar AIO whops...');
    
    // Find all whops with "stellar" in the name
    const stellarWhops = await prisma.whop.findMany({
      where: {
        name: {
          contains: 'Stellar',
          mode: 'insensitive'
        }
      },
      include: {
        PromoCode: true
      },
      orderBy: {
        displayOrder: 'asc'
      }
    });
    
    console.log(`\n📊 Found ${stellarWhops.length} Stellar whops:`);
    stellarWhops.forEach(whop => {
      console.log(`- ID: ${whop.id}`);
      console.log(`  Name: "${whop.name}"`);
      console.log(`  Display Order: ${whop.displayOrder}`);
      console.log(`  Promo Codes: ${whop.PromoCode.length}`);
      if (whop.PromoCode.length > 0) {
        whop.PromoCode.forEach(promo => {
          console.log(`    - Code: ${promo.code}, Value: ${promo.value}, Type: ${promo.type}`);
        });
      }
      console.log('');
    });
    
    // Also check for any promo codes that might reference Stellar
    console.log('🔍 Searching for promo codes mentioning Stellar...');
    const stellarPromos = await prisma.promoCode.findMany({
      where: {
        OR: [
          { code: { contains: 'STELLAR', mode: 'insensitive' } },
          { title: { contains: 'Stellar', mode: 'insensitive' } }
        ]
      },
      include: {
        whop: true
      }
    });
    
    console.log(`\n📊 Found ${stellarPromos.length} Stellar-related promo codes:`);
    stellarPromos.forEach(promo => {
      console.log(`- Code: ${promo.code}`);
      console.log(`  Title: ${promo.title}`);
      console.log(`  Whop: ${promo.whop.name}`);
      console.log(`  Value: ${promo.value}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStellarAIO();