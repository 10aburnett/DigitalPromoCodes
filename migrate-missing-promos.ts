import { PrismaClient } from '@prisma/client';
import { cuid } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

async function migrateMissingPromos() {
  try {
    console.log('🔧 MIGRATING MISSING PROMO CODES');
    console.log('=================================\n');
    
    const missingPromos = [
      {
        whopName: 'The Haven',
        hardcodedCode: 'PROMO-45EF5D24',
        dbCode: 'HAVEN15',
        title: '15% Off Premium Access',
        discount: '15'
      },
      {
        whopName: 'Stellar AIO', 
        hardcodedCode: 'PROMO-1A6008FA',
        dbCode: 'STELLAR15',
        title: '15% Off Premium Access',
        discount: '15'
      },
      {
        whopName: 'Supercar Income',
        hardcodedCode: 'PROMO-5E906FAB', 
        dbCode: 'SUPERCAR20',
        title: '20% Off Premium Access',
        discount: '20'
      }
    ];
    
    for (const promo of missingPromos) {
      console.log(`🔍 Processing: ${promo.whopName}`);
      
      // Find the whop
      const whop = await prisma.whop.findFirst({
        where: { name: promo.whopName },
        include: { PromoCode: true }
      });
      
      if (!whop) {
        console.log(`   ❌ Whop "${promo.whopName}" not found in database`);
        continue;
      }
      
      // Check if promo code already exists
      if (whop.PromoCode.length > 0) {
        console.log(`   ⚠️  Whop already has promo codes: ${whop.PromoCode.map(p => p.code).join(', ')}`);
        continue;
      }
      
      // Add the promo code
      const newPromoCode = await prisma.promoCode.create({
        data: {
          id: cuid(),
          title: promo.title,
          code: promo.dbCode,
          type: 'DISCOUNT',
          value: promo.discount,
          whopId: whop.id
        }
      });
      
      console.log(`   ✅ Added promo code: ${newPromoCode.code} (${promo.discount}% off)`);
    }
    
    // Check for Dodgy's Dungeon
    console.log(`\n🔍 Checking for Dodgy's Dungeon...`);
    const dodgyWhop = await prisma.whop.findFirst({
      where: { 
        name: {
          contains: "Dodgy",
          mode: 'insensitive'
        }
      }
    });
    
    if (dodgyWhop) {
      console.log(`   ✅ Found: "${dodgyWhop.name}" (ID: ${dodgyWhop.id})`);
      
      // Check if it has promo codes
      const dodgyWithPromos = await prisma.whop.findFirst({
        where: { id: dodgyWhop.id },
        include: { PromoCode: true }
      });
      
      if (dodgyWithPromos && dodgyWithPromos.PromoCode.length === 0) {
        console.log(`   🔧 Adding promo code to ${dodgyWhop.name}...`);
        
        const dodgyPromoCode = await prisma.promoCode.create({
          data: {
            id: cuid(),
            title: '30% Off Premium Access',
            code: 'DODGY30',
            type: 'DISCOUNT', 
            value: '30',
            whopId: dodgyWhop.id
          }
        });
        
        console.log(`   ✅ Added promo code: ${dodgyPromoCode.code} (30% off)`);
      } else if (dodgyWithPromos && dodgyWithPromos.PromoCode.length > 0) {
        console.log(`   ⚠️  Already has promo codes: ${dodgyWithPromos.PromoCode.map(p => p.code).join(', ')}`);
      }
    } else {
      console.log(`   ❌ Dodgy's Dungeon not found in database`);
    }
    
    console.log(`\n✅ MIGRATION COMPLETE!`);
    console.log(`Next step: Update displayOrder for all promo whops to top 40 positions.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateMissingPromos();