import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function addMissingHardcodedPromos() {
  try {
    console.log('🔧 ADDING MISSING HARDCODED PROMO CODES');
    console.log('======================================\n');
    
    const missingPromos = [
      {
        whopName: 'Dodgy\'s Dungeon',
        hardcodedCode: 'PROMO-565022F7',
        dbCode: 'DODGY15',
        title: '15% Off Premium Access',
        discount: '15'
      },
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
      
      // Find the exact whop by name
      const whop = await prisma.whop.findFirst({
        where: { name: promo.whopName },
        include: { PromoCode: true }
      });
      
      if (!whop) {
        console.log(`   ❌ Whop "${promo.whopName}" not found in database`);
        continue;
      }
      
      console.log(`   ✅ Found: "${whop.name}" (ID: ${whop.id})`);
      console.log(`   📍 Current display order: ${whop.displayOrder}`);
      console.log(`   📋 Current promo codes: ${whop.PromoCode.length}`);
      
      // Check if promo code already exists
      if (whop.PromoCode.length > 0) {
        console.log(`   ⚠️  Already has promo codes:`);
        whop.PromoCode.forEach(p => {
          console.log(`      - ${p.code}: ${p.value}% off (${p.title})`);
        });
        console.log(`   ⏭️  Skipping...`);
        continue;
      }
      
      // Add the promo code
      const promoId = 'cm' + randomBytes(12).toString('hex');
      const newPromoCode = await prisma.promoCode.create({
        data: {
          id: promoId,
          title: promo.title,
          description: `Get ${promo.discount}% off premium access to ${promo.whopName}`,
          code: promo.dbCode,
          type: 'DISCOUNT',
          value: promo.discount,
          whopId: whop.id,
          updatedAt: new Date()
        }
      });
      
      console.log(`   ✅ Added promo code: ${newPromoCode.code} (${promo.discount}% off)`);
    }
    
    // Get final count
    const finalCount = await prisma.whop.count({
      where: {
        PromoCode: {
          some: {}
        }
      }
    });
    
    console.log(`\n🎉 MIGRATION COMPLETE!`);
    console.log(`📊 FINAL TOTALS:`);
    console.log(`- Whops with promo codes: ${finalCount}`);
    console.log(`- Expected total: 35`);
    
    if (finalCount === 35) {
      console.log(`✅ SUCCESS: All promo codes successfully migrated!`);
      console.log(`🎯 Ready to prioritize all ${finalCount} whops to top positions.`);
    } else {
      console.log(`⚠️  Warning: Expected 35, got ${finalCount}. Check for issues.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingHardcodedPromos();