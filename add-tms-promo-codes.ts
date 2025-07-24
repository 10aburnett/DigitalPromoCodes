import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTMSPromoCodes() {
  console.log('Adding promo codes to TMS whops...\n');

  try {
    // Define the TMS whops and their promo codes
    const tmsPromoMappings = [
      {
        whopId: 'cmbexuzmk002d2jkmouk2i9mx', // TMS+ (Heavy Hitters) 💎
        whopName: 'TMS+ (Heavy Hitters) 💎',
        promoCodes: [
          {
            title: 'VIP Exclusive Access',
            description: 'Get exclusive access to TMS+ Heavy Hitters premium signals and community',
            code: 'TMSHEAVY50',
            type: 'EXCLUSIVE_ACCESS' as const,
            value: '50'
          }
        ]
      },
      {
        whopId: 'cmbexv4sn006r2jkm0ztr995l', // TMS (#1 ON WHOP)
        whopName: 'TMS (#1 ON WHOP)',
        promoCodes: [
          {
            title: 'Premium Betting Access',
            description: 'Join the #1 sports betting community on Whop with premium picks',
            code: 'TMSNO1',
            type: 'EXCLUSIVE_ACCESS' as const,
            value: '100'
          }
        ]
      },
      {
        whopId: 'cmbexvt7100q02jkmk4r7csqc', // TMS Player Props 📊
        whopName: 'TMS Player Props 📊',
        promoCodes: [
          {
            title: 'Player Props Premium',
            description: 'Get exclusive player props analysis and betting insights',
            code: 'TMSPROPS',
            type: 'EXCLUSIVE_ACCESS' as const,
            value: '75'
          }
        ]
      },
      {
        whopId: 'cmbexxxp602e12jkmezvzhx58', // TMS Exclusive VIP Chat
        whopName: 'TMS Exclusive VIP Chat',
        promoCodes: [
          {
            title: 'VIP Chat Access',
            description: 'Join our exclusive VIP trading community with expert signals and analysis',
            code: 'TMSVIP',
            type: 'EXCLUSIVE_ACCESS' as const,
            value: '100'
          }
        ]
      },
      {
        whopId: 'cmbexvwky00sn2jkm5kz1qye2', // TMS Spartan AI Bot
        whopName: 'TMS Spartan AI Bot',
        promoCodes: [
          {
            title: 'AI Trading Bot Access',
            description: 'Get access to the advanced Spartan AI trading bot and VIP community',
            code: 'SPARTANAI',
            type: 'EXCLUSIVE_ACCESS' as const,
            value: '100'
          }
        ]
      }
    ];

    for (const mapping of tmsPromoMappings) {
      console.log(`Processing: ${mapping.whopName}`);
      console.log(`Whop ID: ${mapping.whopId}`);

      // Verify the whop exists
      const whop = await prisma.whop.findUnique({
        where: { id: mapping.whopId },
        include: { PromoCode: true }
      });

      if (!whop) {
        console.log(`❌ Whop with ID "${mapping.whopId}" not found, skipping...`);
        continue;
      }

      console.log(`✅ Found whop: ${whop.name}`);
      console.log(`   Current promo codes: ${whop.PromoCode.length}`);

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
          console.log(`⏭️  Code "${promoData.code}" already exists, skipping...`);
          continue;
        }

        // Create the new promo code
        const newPromoCode = await prisma.promoCode.create({
          data: {
            title: promoData.title,
            description: promoData.description,
            code: promoData.code,
            type: promoData.type,
            value: promoData.value,
            whopId: whop.id
          }
        });

        console.log(`✅ Added promo code: "${promoData.code}" (${promoData.title})`);
        console.log(`   Promo ID: ${newPromoCode.id}`);
      }

      console.log('   ' + '='.repeat(50));
    }

    // Now display the updated status
    console.log('\n' + '='.repeat(80));
    console.log('UPDATED TMS WHOPS WITH PROMO CODES:');
    console.log('='.repeat(80));

    for (const mapping of tmsPromoMappings) {
      const whop = await prisma.whop.findUnique({
        where: { id: mapping.whopId },
        include: { PromoCode: true }
      });

      if (whop) {
        console.log(`\n📦 ${whop.name}`);
        console.log(`   Database ID: ${whop.id}`);
        console.log(`   Slug: ${whop.slug}`);
        console.log(`   Published: ${whop.publishedAt ? 'Yes' : 'No'}`);
        console.log(`   Price: ${whop.price}`);
        console.log(`   Affiliate Link: ${whop.affiliateLink}`);
        
        if (whop.PromoCode.length > 0) {
          console.log(`   Promo Codes (${whop.PromoCode.length}):`);
          whop.PromoCode.forEach((promo, index) => {
            console.log(`     ${index + 1}. "${promo.title}"`);
            console.log(`        Code: ${promo.code}`);
            console.log(`        Type: ${promo.type}`);
            console.log(`        Value: ${promo.value}`);
            console.log(`        Description: ${promo.description}`);
            console.log(`        Promo ID: ${promo.id}`);
          });
        } else {
          console.log(`   Promo Codes: None`);
        }
      }
    }

    console.log('\n🎉 TMS promo codes setup completed!');

  } catch (error) {
    console.error('❌ Error adding TMS promo codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Alternative function to add a custom promo code to any TMS whop
export async function addCustomTMSPromoCode(
  whopId: string,
  promoCode: string,
  title: string,
  description: string,
  type: 'DISCOUNT' | 'FREE_TRIAL' | 'EXCLUSIVE_ACCESS' | 'BUNDLE_DEAL' | 'LIMITED_TIME',
  value: string
) {
  const whop = await prisma.whop.findUnique({
    where: { id: whopId }
  });

  if (!whop) {
    throw new Error(`Whop with ID "${whopId}" not found`);
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

  console.log(`✅ Added custom promo code "${promoCode}" to ${whop.name}`);
  return newPromoCode;
}

// Function to update existing promo codes for TMS whops
export async function updateTMSPromoCode(
  promoCodeId: string,
  updates: {
    code?: string;
    title?: string;
    description?: string;
    type?: 'DISCOUNT' | 'FREE_TRIAL' | 'EXCLUSIVE_ACCESS' | 'BUNDLE_DEAL' | 'LIMITED_TIME';
    value?: string;
  }
) {
  const updatedPromo = await prisma.promoCode.update({
    where: { id: promoCodeId },
    data: updates,
    include: {
      Whop: true
    }
  });

  console.log(`✅ Updated promo code for ${updatedPromo.Whop.name}`);
  console.log(`   Code: ${updatedPromo.code}`);
  console.log(`   Title: ${updatedPromo.title}`);
  
  return updatedPromo;
}

// Run the main function if this script is executed directly
if (require.main === module) {
  addTMSPromoCodes()
    .catch((e) => {
      console.error('❌ Error:', e);
      process.exit(1);
    });
}