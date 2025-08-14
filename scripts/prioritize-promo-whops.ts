import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function prioritizePromoWhops() {
  console.log('🎯 Prioritizing whops with promo codes to appear first...\n');

  try {
    // Get all whops with promo codes (should be 30)
    const whopsWithPromos = await prisma.whop.findMany({
      where: {
        PromoCode: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        displayOrder: true,
        PromoCode: {
          select: {
            code: true,
            value: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✅ Found ${whopsWithPromos.length} whops with promo codes\n`);

    // Set displayOrder 1-30 for promo whops
    console.log('📋 Setting displayOrder 1-30 for promo whops:');
    
    for (let i = 0; i < whopsWithPromos.length; i++) {
      const whop = whopsWithPromos[i];
      const newOrder = i + 1;
      
      await prisma.whop.update({
        where: { id: whop.id },
        data: { displayOrder: newOrder }
      });

      console.log(`${newOrder.toString().padStart(2, ' ')}. ${whop.name}`);
      console.log(`    Code: ${whop.PromoCode[0]?.code} | Value: ${whop.PromoCode[0]?.value}${whop.PromoCode[0]?.value?.includes('%') || whop.PromoCode[0]?.value?.includes('off') || whop.PromoCode[0]?.value?.includes('$') ? '' : '%'}`);
    }

    // Get all whops WITHOUT promo codes
    const whopsWithoutPromos = await prisma.whop.findMany({
      where: {
        PromoCode: {
          none: {}
        }
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        createdAt: 'desc' // Most recent whops first after the promo ones
      }
    });

    console.log(`\n📦 Setting displayOrder 31+ for ${whopsWithoutPromos.length} whops without promos...`);

    // Set displayOrder 31+ for non-promo whops
    const batchSize = 1000; // Update in batches for performance
    for (let i = 0; i < whopsWithoutPromos.length; i += batchSize) {
      const batch = whopsWithoutPromos.slice(i, i + batchSize);
      
      const updatePromises = batch.map((whop, batchIndex) => {
        const newOrder = 31 + i + batchIndex;
        return prisma.whop.update({
          where: { id: whop.id },
          data: { displayOrder: newOrder }
        });
      });

      await Promise.all(updatePromises);
      console.log(`   Updated batch ${Math.floor(i/batchSize) + 1}: positions ${31 + i} to ${Math.min(31 + i + batchSize - 1, 30 + whopsWithoutPromos.length)}`);
    }

    // Verification
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERIFICATION - First 35 whops after reordering:');
    console.log('='.repeat(80));

    const firstWhops = await prisma.whop.findMany({
      take: 35,
      orderBy: {
        displayOrder: 'asc'
      },
      select: {
        displayOrder: true,
        name: true,
        PromoCode: {
          select: {
            code: true
          }
        }
      }
    });

    firstWhops.forEach((whop) => {
      const hasPromo = whop.PromoCode.length > 0;
      const status = hasPromo ? '✅ PROMO' : '❌ NO PROMO';
      console.log(`${whop.displayOrder?.toString().padStart(2, ' ')}. ${whop.name.substring(0, 50)}${whop.name.length > 50 ? '...' : ''} | ${status}`);
    });

    console.log('\n📊 SUMMARY:');
    console.log(`✅ Positions 1-30: Whops WITH promo codes (${whopsWithPromos.length} whops)`);
    console.log(`📦 Positions 31+: Whops WITHOUT promo codes (${whopsWithoutPromos.length} whops)`);
    console.log(`🎯 Total whops reordered: ${whopsWithPromos.length + whopsWithoutPromos.length}`);
    
    console.log('\n🎉 Promo whops are now prioritized to appear first on your site!');
    console.log('💡 Future promo codes will automatically follow this pattern when you add displayOrder values');

  } catch (error) {
    console.error('❌ Error prioritizing promo whops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
prioritizePromoWhops()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });