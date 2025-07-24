import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function prioritizeAllPromos() {
  try {
    console.log('🔥 PRIORITIZING ALL WHOPS WITH PROMO CODES');
    console.log('==========================================\n');
    
    // Get all whops with promo codes
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
    
    console.log(`📊 Found ${whopsWithPromos.length} whops with promo codes`);
    console.log(`🎯 Moving all to positions 1-${whopsWithPromos.length}...\n`);
    
    // Update each whop's display order
    for (let i = 0; i < whopsWithPromos.length; i++) {
      const whop = whopsWithPromos[i];
      const newDisplayOrder = i + 1;
      
      if (whop.displayOrder !== newDisplayOrder) {
        await prisma.whop.update({
          where: { id: whop.id },
          data: { displayOrder: newDisplayOrder }
        });
        
        console.log(`✅ "${whop.name}" moved from position ${whop.displayOrder} → ${newDisplayOrder}`);
      } else {
        console.log(`✓ "${whop.name}" already at position ${whop.displayOrder}`);
      }
    }
    
    // Move all other whops to start after the promo ones
    const nonPromoWhops = await prisma.whop.findMany({
      where: {
        PromoCode: {
          none: {}
        }
      },
      orderBy: {
        displayOrder: 'asc'
      }
    });
    
    console.log(`\n📊 Moving ${nonPromoWhops.length} non-promo whops to positions ${whopsWithPromos.length + 1}+...\n`);
    
    let counter = 0;
    for (const whop of nonPromoWhops) {
      const newDisplayOrder = whopsWithPromos.length + 1 + counter;
      
      if (whop.displayOrder !== newDisplayOrder) {
        await prisma.whop.update({
          where: { id: whop.id },
          data: { displayOrder: newDisplayOrder }
        });
        
        if (counter < 5) { // Only show first 5 to avoid spam
          console.log(`✅ "${whop.name}" moved from position ${whop.displayOrder} → ${newDisplayOrder}`);
        } else if (counter === 5) {
          console.log(`... (continuing to move ${nonPromoWhops.length - 5} more whops)`);
        }
      }
      counter++;
    }
    
    console.log(`\n🎉 PRIORITIZATION COMPLETE!`);
    console.log(`📊 FINAL ARRANGEMENT:`);
    console.log(`- Positions 1-${whopsWithPromos.length}: Whops WITH promo codes (for legitimacy)`);
    console.log(`- Positions ${whopsWithPromos.length + 1}+: Whops WITHOUT promo codes`);
    
    // Show top 10 for verification
    const top10 = await prisma.whop.findMany({
      take: 10,
      include: { PromoCode: true },
      orderBy: { displayOrder: 'asc' }
    });
    
    console.log(`\n🔝 TOP 10 WHOPS (verification):`);
    top10.forEach((whop, index) => {
      const promoCount = whop.PromoCode.length;
      const promoCodes = whop.PromoCode.map(p => p.code).join(', ');
      console.log(`${index + 1}. "${whop.name}" - ${promoCount} promo${promoCount !== 1 ? 's' : ''} ${promoCodes ? `(${promoCodes})` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

prioritizeAllPromos();