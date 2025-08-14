import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple cuid-like ID generator
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cm';
  for (let i = 0; i < 23; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function updateTMSPromoCodes() {
  console.log('Updating TMS promo codes...\n');

  try {
    // Define the updated TMS promo codes
    const tmsPromoUpdates = [
      {
        whopId: 'cmbexuzmk002d2jkmouk2i9mx', // TMS+ (Heavy Hitters) 💎
        whopName: 'TMS+ (Heavy Hitters) 💎',
        promoCode: {
          title: '7 Days for $1 Special',
          description: 'Get 7 days access to TMS+ Heavy Hitters premium signals for just $1',
          code: '7DAYSFOR1',
          type: 'DISCOUNT' as const,
          value: '$29.00 off'
        }
      },
      {
        whopId: 'cmbexv4sn006r2jkm0ztr995l', // TMS (#1 ON WHOP)
        whopName: 'TMS (#1 ON WHOP)',
        promoCode: {
          title: '7 Days for $1 Special',
          description: 'Get 7 days access to the #1 sports betting community on Whop for just $1',
          code: '7DAYSFOR1',
          type: 'DISCOUNT' as const,
          value: '$29.00 off'
        }
      },
      {
        whopId: 'cmbexvt7100q02jkmk4r7csqc', // TMS Player Props 📊
        whopName: 'TMS Player Props 📊',
        promoCode: {
          title: '7 Days for $1 Special',
          description: 'Get 7 days access to exclusive player props analysis for just $1',
          code: '7DAYSFOR1',
          type: 'DISCOUNT' as const,
          value: '$29.00 off'
        }
      },
      {
        whopId: 'cmbexxxp602e12jkmezvzhx58', // TMS Exclusive VIP Chat
        whopName: 'TMS Exclusive VIP Chat',
        promoCode: {
          title: '25% Off VIP Access',
          description: 'Get 25% off exclusive VIP trading community access',
          code: 'PROMO-327DB8FC',
          type: 'DISCOUNT' as const,
          value: '25'
        }
      },
      {
        whopId: 'cmbexvwky00sn2jkm5kz1qye2', // TMS Spartan AI Bot
        whopName: 'TMS Spartan AI Bot',
        promoCode: {
          title: '25% Off AI Bot Access',
          description: 'Get 25% off access to the advanced Spartan AI trading bot',
          code: 'PROMO-327DB8FC',
          type: 'DISCOUNT' as const,
          value: '25'
        }
      }
    ];

    for (const update of tmsPromoUpdates) {
      console.log(`Processing: ${update.whopName}`);
      console.log(`Whop ID: ${update.whopId}`);

      // Verify the whop exists
      const whop = await prisma.whop.findUnique({
        where: { id: update.whopId },
        include: { PromoCode: true }
      });

      if (!whop) {
        console.log(`❌ Whop with ID "${update.whopId}" not found, skipping...`);
        continue;
      }

      console.log(`✅ Found whop: ${whop.name}`);

      // Delete existing promo codes for this whop
      if (whop.PromoCode.length > 0) {
        await prisma.promoCode.deleteMany({
          where: { whopId: whop.id }
        });
        console.log(`🗑️  Deleted ${whop.PromoCode.length} existing promo codes`);
      }

      // Create the new promo code
      const newPromoCode = await prisma.promoCode.create({
        data: {
          id: generateId(),
          title: update.promoCode.title,
          description: update.promoCode.description,
          code: update.promoCode.code,
          type: update.promoCode.type,
          value: update.promoCode.value,
          whopId: whop.id,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Added new promo code: "${update.promoCode.code}"`);
      console.log(`   Title: ${update.promoCode.title}`);
      console.log(`   Value: ${update.promoCode.value}`);
      console.log(`   Promo ID: ${newPromoCode.id}`);
      console.log('   ' + '='.repeat(50));
    }

    // Display the updated status
    console.log('\n' + '='.repeat(80));
    console.log('UPDATED TMS WHOPS WITH NEW PROMO CODES:');
    console.log('='.repeat(80));

    for (const update of tmsPromoUpdates) {
      const whop = await prisma.whop.findUnique({
        where: { id: update.whopId },
        include: { PromoCode: true }
      });

      if (whop) {
        console.log(`\n📦 ${whop.name}`);
        console.log(`   Database ID: ${whop.id}`);
        console.log(`   Slug: ${whop.slug}`);
        console.log(`   Price: ${whop.price}`);
        
        if (whop.PromoCode.length > 0) {
          whop.PromoCode.forEach((promo) => {
            console.log(`   ✅ Promo Code: "${promo.code}"`);
            console.log(`      Title: ${promo.title}`);
            console.log(`      Type: ${promo.type}`);
            console.log(`      Value: ${promo.value}`);
            console.log(`      Description: ${promo.description}`);
          });
        }
      }
    }

    console.log('\n🎉 TMS promo codes updated successfully!');

  } catch (error) {
    console.error('❌ Error updating TMS promo codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
updateTMSPromoCodes()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });