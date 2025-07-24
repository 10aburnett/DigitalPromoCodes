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

async function updateNewPromoCodes() {
  console.log('Updating new promo codes...\n');

  try {
    // Define the new promo code updates
    const promoUpdates = [
      {
        whopName: 'ZWM Gold',
        promoCode: {
          title: '50% Off Premium Access',
          description: 'Get 50% off ZWM Gold premium trading community access',
          code: 'PROMO-73841533',
          type: 'DISCOUNT' as const,
          value: '50'
        }
      },
      {
        whopName: 'PJ Trades Premium',
        promoCode: {
          title: '10% Off Premium Access',
          description: 'Get 10% off PJ Trades Premium trading signals and community',
          code: 'PROMO-1EDC4580',
          type: 'DISCOUNT' as const,
          value: '10'
        }
      },
      {
        whopName: "Dodgy's Dungeon",
        promoCode: {
          title: '15% Off Premium Access',
          description: "Get 15% off Dodgy's Dungeon exclusive trading community",
          code: 'PROMO-565022F7',
          type: 'DISCOUNT' as const,
          value: '15'
        }
      },
      {
        whopName: 'The Delta Vader - Copy Tader',
        promoCode: {
          title: '10% Off Copy Trading Access',
          description: 'Get 10% off The Delta Vader copy trading premium access',
          code: 'PROMO-7DBFEB18',
          type: 'DISCOUNT' as const,
          value: '10'
        }
      }
    ];

    for (const update of promoUpdates) {
      console.log(`Processing: ${update.whopName}`);

      // Search for the whop by name (case-insensitive and partial match)
      const whops = await prisma.whop.findMany({
        where: {
          name: {
            contains: update.whopName,
            mode: 'insensitive'
          }
        },
        include: { PromoCode: true }
      });

      if (whops.length === 0) {
        console.log(`❌ No whop found with name containing "${update.whopName}"`);
        
        // Try alternative search patterns
        const searchTerms = update.whopName.split(' ');
        const altWhops = await prisma.whop.findMany({
          where: {
            OR: searchTerms.map(term => ({
              name: {
                contains: term,
                mode: 'insensitive'
              }
            }))
          },
          include: { PromoCode: true }
        });

        if (altWhops.length > 0) {
          console.log(`   Found ${altWhops.length} similar whops:`);
          altWhops.forEach(w => console.log(`   - ${w.name} (ID: ${w.id})`));
        }
        
        console.log('   ' + '='.repeat(50));
        continue;
      }

      if (whops.length > 1) {
        console.log(`⚠️  Found multiple whops with similar names:`);
        whops.forEach(w => console.log(`   - ${w.name} (ID: ${w.id})`));
        console.log(`   Using first match: ${whops[0].name}`);
      }

      const whop = whops[0];
      console.log(`✅ Found whop: ${whop.name}`);
      console.log(`   Database ID: ${whop.id}`);

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
      console.log(`   Value: ${update.promoCode.value}%`);
      console.log(`   Promo ID: ${newPromoCode.id}`);
      console.log('   ' + '='.repeat(50));
    }

    // Display the updated status
    console.log('\n' + '='.repeat(80));
    console.log('UPDATED WHOPS WITH NEW PROMO CODES:');
    console.log('='.repeat(80));

    for (const update of promoUpdates) {
      const whops = await prisma.whop.findMany({
        where: {
          name: {
            contains: update.whopName,
            mode: 'insensitive'
          }
        },
        include: { PromoCode: true }
      });

      if (whops.length > 0) {
        const whop = whops[0];
        console.log(`\n📦 ${whop.name}`);
        console.log(`   Database ID: ${whop.id}`);
        console.log(`   Slug: ${whop.slug}`);
        console.log(`   Price: ${whop.price}`);
        
        if (whop.PromoCode.length > 0) {
          whop.PromoCode.forEach((promo) => {
            console.log(`   ✅ Promo Code: "${promo.code}"`);
            console.log(`      Title: ${promo.title}`);
            console.log(`      Type: ${promo.type}`);
            console.log(`      Value: ${promo.value}%`);
            console.log(`      Description: ${promo.description}`);
          });
        }
      }
    }

    console.log('\n🎉 New promo codes updated successfully!');

  } catch (error) {
    console.error('❌ Error updating promo codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
updateNewPromoCodes()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });