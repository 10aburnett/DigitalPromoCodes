import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding sample promo codes to existing whops...');

  // Get first 5 whops to add promo codes to
  const whops = await prisma.deal.findMany({
    take: 5,
    include: { promoCodes: true }
  });

  console.log(`Found ${whops.length} whops to add promo codes to`);

  for (const whop of whops) {
    // Skip if this whop already has promo codes
    if (whop.promoCodes.length > 0) {
      console.log(`Whop "${whop.name}" already has promo codes, skipping...`);
      continue;
    }

    console.log(`Adding promo codes for whop: ${whop.name}`);

    // Create a few different types of promo codes for this whop
    await prisma.promoCode.createMany({
      data: [
        {
          title: 'Exclusive Access',
          description: 'Get exclusive access to premium content',
          code: null, // No code needed, just direct access
          type: 'EXCLUSIVE_ACCESS',
          value: '100',
          whopId: whop.id
        },
        {
          title: '20% Off First Month',
          description: 'Save 20% on your first month subscription',
          code: 'SAVE20',
          type: 'DISCOUNT',
          value: '20',
          whopId: whop.id
        },
        {
          title: 'Free Trial',
          description: '7-day free trial access',
          code: 'FREETRIAL',
          type: 'FREE_TRIAL',
          value: '7',
          whopId: whop.id
        }
      ]
    });

    console.log(`Added 3 promo codes for "${whop.name}"`);
  }

  console.log('Sample promo codes added successfully!');
}

main()
  .catch((e) => {
    console.error('Error adding sample promo codes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 