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

async function migrateHardcodedPromos() {
  console.log('🚀 Migrating hardcoded promo codes to database...\n');
  console.log('⚠️  PRESERVING EXACT FORMATTING - No UX changes will occur\n');

  try {
    // Exact hardcoded promo mappings (preserving original values)
    const hardcodedPromos = [
      {
        searchName: 'Josh Exclusive VIP Access',
        exactName: 'Josh Exclusive VIP Access',
        discount: '20', // Will display as "20%" - same as before
        code: 'JOSH20'
      },
      {
        searchName: 'Momentum Monthly',
        exactName: 'Momentum Monthly',
        discount: '20',
        code: 'MOMENTUM20'
      },
      {
        searchName: 'Larry\'s Lounge Premium',
        exactName: 'Larry\'s Lounge Premium',
        discount: '25',
        code: 'LARRY25'
      },
      {
        searchName: 'Trade With Insight - Pro',
        exactName: 'Trade With Insight - Pro',
        discount: '15',
        code: 'INSIGHT15'
      },
      {
        searchName: 'ParlayScience Discord Access',
        exactName: 'ParlayScience Discord Access',
        discount: '20',
        code: 'PARLAY20'
      },
      {
        searchName: 'Scarface Trades Premium',
        exactName: 'Scarface Trades Premium',
        discount: '25',
        code: 'SCARFACE25'
      },
      {
        searchName: 'The Haven',
        exactName: 'The Haven (Pay with Crypto)',
        discount: '10',
        code: 'HAVEN10'
      },
      {
        searchName: 'PropFellas VIP',
        exactName: 'PropFellas VIP',
        discount: '10',
        code: 'PROPFELLAS10'
      },
      {
        searchName: 'Owls Full Access',
        exactName: 'Owls Full Access',
        discount: '20',
        code: 'OWLS20'
      },
      {
        searchName: 'Stellar AIO',
        exactName: 'Stellar AIO 3rd Instance',
        discount: '20',
        code: 'STELLAR20'
      },
      {
        searchName: 'Goat Ecom Growth',
        exactName: 'Goat Ecom Growth',
        discount: '10',
        code: 'GOATECOM10'
      },
      {
        searchName: 'Indicators & VIP | LIFETIME',
        exactName: 'Indicators & VIP | LIFETIME',
        discount: '10',
        code: 'INDICATORS10'
      },
      {
        searchName: 'Supercar Income',
        exactName: 'Supercar Income Broker',
        discount: '5',
        code: 'SUPERCAR5'
      },
      {
        searchName: 'GOAT Sports Bets Membership',
        exactName: 'GOAT Sports Bets Membership',
        discount: '20',
        code: 'GOATSPORTS20'
      },
      {
        searchName: 'Best Of Both Worlds',
        exactName: 'Best Of Both Worlds',
        discount: '5',
        code: 'BESTWORLDS5'
      },
      {
        searchName: 'Moementum University',
        exactName: 'Moementum University',
        discount: '10',
        code: 'MOMENTUM10'
      },
      {
        searchName: 'ZWM Lifetime Access',
        exactName: 'ZWM Lifetime Access',
        discount: '40',
        code: 'ZWMLIFE40'
      },
      {
        searchName: 'Ayecon Academy Lifetime Membership',
        exactName: 'Ayecon Academy Lifetime Membership',
        discount: '10',
        code: 'AYECONLIFE10'
      },
      {
        searchName: 'The BFI Traders University',
        exactName: 'The BFI Traders University',
        discount: '15',
        code: 'BFI15'
      }
    ];

    let migrated = 0;
    let skipped = 0;

    for (const promo of hardcodedPromos) {
      console.log(`Processing: ${promo.exactName}`);

      // Search for the whop (flexible search)
      const whops = await prisma.whop.findMany({
        where: {
          name: {
            contains: promo.searchName.replace(/'/g, ''),
            mode: 'insensitive'
          }
        },
        include: { PromoCode: true }
      });

      if (whops.length === 0) {
        console.log(`❌ No whop found for "${promo.exactName}"`);
        skipped++;
        console.log('   ' + '='.repeat(50));
        continue;
      }

      const whop = whops[0];
      console.log(`✅ Found whop: ${whop.name}`);
      console.log(`   Database ID: ${whop.id}`);

      // Check if it already has database promo codes
      if (whop.PromoCode.length > 0) {
        console.log(`⚠️  Already has ${whop.PromoCode.length} database promo codes - skipping to avoid conflicts`);
        skipped++;
        console.log('   ' + '='.repeat(50));
        continue;
      }

      // Create the new promo code with exact same formatting as hardcoded
      const newPromoCode = await prisma.promoCode.create({
        data: {
          id: generateId(),
          title: `${promo.discount}% Off Premium Access`,
          description: `Get ${promo.discount}% off ${whop.name} premium access`,
          code: promo.code,
          type: 'DISCOUNT',
          value: promo.discount, // Store as number string (no % symbol)
          whopId: whop.id,
          updatedAt: new Date()
        }
      });

      console.log(`✅ Migrated promo code: "${promo.code}"`);
      console.log(`   Value: ${promo.discount}% (will display exactly as before)`);
      console.log(`   Promo ID: ${newPromoCode.id}`);
      migrated++;
      console.log('   ' + '='.repeat(50));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Successfully migrated: ${migrated} promo codes`);
    console.log(`⏭️  Skipped (conflicts/not found): ${skipped} promo codes`);
    console.log(`📋 Total processed: ${hardcodedPromos.length} promo codes`);

    if (migrated > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('📌 Next step: Update frontend to remove hardcoded arrays');
      console.log('💡 UX will remain exactly the same - users won\'t notice any changes');
    }

  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateHardcodedPromos()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });