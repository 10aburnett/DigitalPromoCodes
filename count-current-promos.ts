import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countCurrentPromos() {
  try {
    console.log('🔢 COUNTING CURRENT PROMO CODES IN DATABASE');
    console.log('===========================================\n');
    
    // Get count of whops with promo codes
    const whopsWithPromos = await prisma.whop.findMany({
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
    
    console.log(`📊 CURRENT DATABASE STATE:`);
    console.log(`- Whops with promo codes: ${whopsWithPromos.length}`);
    console.log(`- Total promo codes: ${whopsWithPromos.reduce((sum, whop) => sum + whop.PromoCode.length, 0)}`);
    
    console.log(`\n📋 ALL WHOPS WITH PROMO CODES:`);
    whopsWithPromos.forEach((whop, index) => {
      console.log(`${index + 1}. [${whop.displayOrder}] "${whop.name}"`);
      whop.PromoCode.forEach(promo => {
        console.log(`     - ${promo.code}: ${promo.value}% off (${promo.title})`);
      });
    });
    
    return whopsWithPromos.length;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

countCurrentPromos();