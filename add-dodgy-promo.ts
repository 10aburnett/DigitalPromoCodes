import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function addDodgyPromo() {
  try {
    console.log('🔧 ADDING MISSING DODGY\'S DUNGEON PROMO CODE');
    console.log('==============================================\n');
    
    // Find Dodgy's Ultimate Course
    const dodgyWhop = await prisma.whop.findFirst({
      where: {
        name: "Dodgy's Ultimate Course"
      },
      include: { PromoCode: true }
    });
    
    if (!dodgyWhop) {
      console.log('❌ Dodgy\'s Ultimate Course not found');
      return;
    }
    
    console.log(`✅ Found: "${dodgyWhop.name}" (ID: ${dodgyWhop.id})`);
    console.log(`   Current display order: ${dodgyWhop.displayOrder}`);
    console.log(`   Current promo codes: ${dodgyWhop.PromoCode.length}`);
    
    if (dodgyWhop.PromoCode.length > 0) {
      console.log('⚠️  Already has promo codes:');
      dodgyWhop.PromoCode.forEach(promo => {
        console.log(`     - ${promo.code}: ${promo.value}% off (${promo.title})`);
      });
      console.log('Skipping...');
      return;
    }
    
    // Add the promo code  
    const promoId = 'cm' + randomBytes(12).toString('hex');
    const newPromoCode = await prisma.promoCode.create({
      data: {
        id: promoId,
        title: '30% Off Premium Access',
        description: 'Get 30% off premium access to Dodgy\'s Ultimate Course',
        code: 'DODGY30',
        type: 'DISCOUNT',
        value: '30',
        whopId: dodgyWhop.id,
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Successfully added promo code: ${newPromoCode.code} (30% off)`);
    
    // Get final count
    const finalCount = await prisma.whop.count({
      where: {
        PromoCode: {
          some: {}
        }
      }
    });
    
    console.log(`\n📊 FINAL TOTALS:`);
    console.log(`- Whops with promo codes: ${finalCount}`);
    console.log(`- Hardcoded promo codes: 20`);
    console.log(`- Database-only promo codes: ${finalCount - 20}`);
    console.log(`- Total should match: ${finalCount} whops in database`);
    
    if (finalCount >= 31) {
      console.log(`✅ SUCCESS: All hardcoded promo codes are now in database!`);
    } else {
      console.log(`⚠️  Warning: Expected at least 31, got ${finalCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addDodgyPromo();