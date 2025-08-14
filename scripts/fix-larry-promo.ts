import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cm';
  for (let i = 0; i < 23; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function fixLarryPromo() {
  console.log('🔧 Fixing Larry\'s Lounge Premium migration...\n');
  
  const whop = await prisma.whop.findUnique({
    where: { id: 'cmbexv3u4005r2jkmaoh1rryd' },
    include: { PromoCode: true }
  });
  
  if (!whop) {
    console.log('❌ Whop not found');
    return;
  }
  
  console.log(`✅ Found: ${whop.name}`);
  console.log(`   Current promo codes: ${whop.PromoCode.length}`);
  
  if (whop.PromoCode.length > 0) {
    console.log('⚠️  Already has promo codes - skipping to avoid conflicts');
    return;
  }
  
  // Create the missing promo code
  const newPromo = await prisma.promoCode.create({
    data: {
      id: generateId(),
      title: '25% Off Premium Access',
      description: 'Get 25% off Larry\'s Lounge Premium access with expert picks and exclusive events',
      code: 'LARRY25',
      type: 'DISCOUNT',
      value: '25', // Will display as 25% - same as hardcoded
      whopId: whop.id,
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Successfully added promo code: "${newPromo.code}"`);
  console.log(`   Value: 25% (will display exactly as before)`);
  console.log(`   Promo ID: ${newPromo.id}`);
  
  await prisma.$disconnect();
}

fixLarryPromo().catch(console.error);