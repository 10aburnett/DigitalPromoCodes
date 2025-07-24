import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function comprehensivePromoAudit() {
  try {
    console.log('🔍 COMPREHENSIVE PROMO CODE AUDIT');
    console.log('===================================\n');
    
    // Get ALL whops with promo codes, ordered by displayOrder
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
    
    console.log(`📊 TOTAL WHOPS WITH PROMO CODES: ${whopsWithPromos.length}\n`);
    
    // Check which ones are in top 30 vs not
    const top30 = whopsWithPromos.filter(w => w.displayOrder <= 30);
    const notInTop30 = whopsWithPromos.filter(w => w.displayOrder > 30);
    
    console.log(`✅ IN TOP 30: ${top30.length} whops`);
    console.log(`❌ NOT IN TOP 30: ${notInTop30.length} whops\n`);
    
    console.log('🔥 WHOPS WITH PROMO CODES NOT IN TOP 30:');
    console.log('==========================================');
    notInTop30.forEach((whop, index) => {
      console.log(`${index + 1}. "${whop.name}"`);
      console.log(`   Display Order: ${whop.displayOrder}`);
      console.log(`   Promo Codes: ${whop.PromoCode.length}`);
      whop.PromoCode.forEach(promo => {
        console.log(`     - ${promo.code}: ${promo.value}% off (${promo.title})`);
      });
      console.log('');
    });
    
    console.log('\n✅ WHOPS WITH PROMO CODES IN TOP 30:');
    console.log('====================================');
    top30.forEach((whop, index) => {
      console.log(`${index + 1}. [${whop.displayOrder}] "${whop.name}"`);
      whop.PromoCode.forEach(promo => {
        console.log(`     - ${promo.code}: ${promo.value}% off`);
      });
    });
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`- Total whops with promo codes: ${whopsWithPromos.length}`);
    console.log(`- Currently in top 30: ${top30.length}`);
    console.log(`- Missing from top 30: ${notInTop30.length}`);
    
    if (notInTop30.length > 0) {
      console.log(`\n⚠️  URGENT: ${notInTop30.length} whops with promo codes are NOT prioritized!`);
      console.log('These need to be moved to positions 1-30 for legitimacy.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

comprehensivePromoAudit();