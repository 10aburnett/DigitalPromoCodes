import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding promo codes to specific whops...');

  // Define which whops should get promo codes and what codes they should have
  const whopPromoMappings = [
    {
      whopSlug: 'your-whop-slug-here', // Replace with actual whop slug
      promoCodes: [
        {
          title: 'Early Bird Discount',
          description: 'Get 30% off with this exclusive early bird offer',
          code: 'EARLYBIRD30',
          type: 'DISCOUNT' as const,
          value: '30'
        }
      ]
    },
    {
      whopSlug: 'another-whop-slug', // Replace with actual whop slug
      promoCodes: [
        {
          title: 'Premium Access',
          description: 'Get premium access with 50% off your first month',
          code: 'PREMIUM50',
          type: 'DISCOUNT' as const,
          value: '50'
        },
        {
          title: 'Free Trial',
          description: '14-day free trial access',
          code: 'TRIAL14',
          type: 'FREE_TRIAL' as const,
          value: '14'
        }
      ]
    }
    // Add more whops here as needed
  ];

  for (const mapping of whopPromoMappings) {
    // Find the whop by slug
    const whop = await prisma.deal.findUnique({
      where: { slug: mapping.whopSlug },
      include: { promoCodes: true }
    });

    if (!whop) {
      console.log(`❌ Whop with slug "${mapping.whopSlug}" not found, skipping...`);
      continue;
    }

    console.log(`\n📝 Processing whop: ${whop.name} (${whop.slug})`);

    // Remove existing promo codes with null code (no-code-needed ones) 
    // to replace them with actual codes
    const existingNullCodes = whop.promoCodes.filter(pc => pc.code === null);
    if (existingNullCodes.length > 0) {
      await prisma.promoCode.deleteMany({
        where: {
          whopId: whop.id,
          code: null
        }
      });
      console.log(`🗑️  Removed ${existingNullCodes.length} "no code needed" promo codes`);
    }

    // Add the new promo codes
    for (const promoData of mapping.promoCodes) {
      // Check if this code already exists for this whop
      const existingCode = await prisma.promoCode.findFirst({
        where: {
          whopId: whop.id,
          code: promoData.code
        }
      });

      if (existingCode) {
        console.log(`⏭️  Code "${promoData.code}" already exists for ${whop.name}, skipping...`);
        continue;
      }

      // Create the new promo code
      await prisma.promoCode.create({
        data: {
          title: promoData.title,
          description: promoData.description,
          code: promoData.code,
          type: promoData.type,
          value: promoData.value,
          whopId: whop.id
        }
      });

      console.log(`✅ Added promo code "${promoData.code}" (${promoData.title}) to ${whop.name}`);
    }
  }

  console.log('\n🎉 Promo codes added successfully!');
}

// Alternative function to add a single promo code to a specific whop
export async function addPromoCodeToWhop(
  whopSlug: string,
  promoCode: string,
  title: string,
  description: string,
  type: 'DISCOUNT' | 'FREE_TRIAL' | 'EXCLUSIVE_ACCESS' | 'BUNDLE_DEAL' | 'LIMITED_TIME',
  value: string
) {
  const whop = await prisma.deal.findUnique({
    where: { slug: whopSlug }
  });

  if (!whop) {
    throw new Error(`Whop with slug "${whopSlug}" not found`);
  }

  // Check if code already exists
  const existingCode = await prisma.promoCode.findFirst({
    where: {
      whopId: whop.id,
      code: promoCode
    }
  });

  if (existingCode) {
    console.log(`Code "${promoCode}" already exists for ${whop.name}`);
    return existingCode;
  }

  // Create the promo code
  const newPromoCode = await prisma.promoCode.create({
    data: {
      title,
      description,
      code: promoCode,
      type,
      value,
      whopId: whop.id
    }
  });

  console.log(`✅ Added promo code "${promoCode}" to ${whop.name}`);
  return newPromoCode;
}

// Function to list all whops and their current promo codes
export async function listWhopsWithPromoCodes() {
  const whops = await prisma.deal.findMany({
    include: {
      promoCodes: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  console.log('\n📋 Current Whops and their Promo Codes:');
  console.log('=====================================');

  for (const whop of whops) {
    console.log(`\n🏢 ${whop.name} (slug: ${whop.slug})`);
    
    if (whop.promoCodes.length === 0) {
      console.log('   No promo codes');
    } else {
      whop.promoCodes.forEach((promo, index) => {
        const codeDisplay = promo.code || 'NO CODE NEEDED';
        console.log(`   ${index + 1}. ${promo.title} - Code: ${codeDisplay} (${promo.type}, ${promo.value}${promo.type === 'DISCOUNT' ? '%' : ''})`);
      });
    }
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Error adding promo codes:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}