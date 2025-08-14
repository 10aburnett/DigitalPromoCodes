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

async function updateDodgyPromo() {
  console.log('Updating Dodgy\'s Dungeon promo code...');
  
  const whop = await prisma.whop.findUnique({
    where: { id: 'cmbexv2rh004w2jkmscda8h5t' },
    include: { PromoCode: true }
  });
  
  if (!whop) {
    console.log('Whop not found');
    return;
  }
  
  console.log(`Found: ${whop.name}`);
  
  // Delete existing promo codes
  if (whop.PromoCode.length > 0) {
    await prisma.promoCode.deleteMany({ where: { whopId: whop.id } });
    console.log(`Deleted ${whop.PromoCode.length} existing promo codes`);
  }
  
  // Create new promo code
  const newPromo = await prisma.promoCode.create({
    data: {
      id: generateId(),
      title: '15% Off Premium Access',
      description: 'Get 15% off Dodgy\'s Dungeon exclusive trading community',
      code: 'PROMO-565022F7',
      type: 'DISCOUNT',
      value: '15',
      whopId: whop.id,
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Added promo code: ${newPromo.code}`);
  console.log(`   Value: ${newPromo.value}%`);
  
  await prisma.$disconnect();
}

updateDodgyPromo().catch(console.error);