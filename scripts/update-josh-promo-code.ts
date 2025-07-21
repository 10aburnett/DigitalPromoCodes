import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating Josh Exclusive VIP Access promo code...');

  // Find the Josh whop by slug
  const whop = await prisma.whop.findUnique({
    where: { slug: 'josh-exclusive-vip-access' },
    include: { promoCodes: true }
  });

  if (!whop) {
    console.log('❌ Josh Exclusive VIP Access whop not found');
    return;
  }

  console.log(`✅ Found whop: ${whop.name}`);
  console.log(`Current promo codes: ${whop.promoCodes.length}`);

  // Update existing promo codes or create new one
  if (whop.promoCodes.length > 0) {
    // Update the first promo code to use "JOSH" code
    const firstPromo = whop.promoCodes[0];
    
    await prisma.promoCode.update({
      where: { id: firstPromo.id },
      data: {
        code: 'JOSH',
        title: '20% Off Discount',
        description: 'Get 20% off with promo code JOSH',
        type: 'DISCOUNT',
        value: '20'
      }
    });
    
    console.log(`✅ Updated existing promo code to: JOSH (20% off)`);
  } else {
    // Create new promo code
    await prisma.promoCode.create({
      data: {
        title: '20% Off Discount',
        description: 'Get 20% off with promo code JOSH',
        code: 'JOSH',
        type: 'DISCOUNT',
        value: '20',
        whopId: whop.id
      }
    });
    
    console.log(`✅ Created new promo code: JOSH (20% off)`);
  }

  console.log('🎉 Josh promo code updated successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error updating Josh promo code:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });