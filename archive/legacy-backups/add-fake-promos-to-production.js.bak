const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function addFakePromosToProduction() {
  try {
    console.log('🎯 ADDING FAKE PROMO CODES TO PRODUCTION DATABASE\n');

    const highTrafficCourses = [
      'Brez marketing ERT',
      'Remakeit.io creator', 
      'Interbank Trading Room',
      'Josh Exclusive VIP Access',
      'EquiFix',
      'LinkedIn Client Lab',
      'Lowkey Discord Membership',
      'Risen Consulting',
      'Learn to Trade Academy',
      'Royalty Hero Premium',
      'The Blue Vortex',
      'ThinkorSwim Blessing',
      'ThinkorSwim Master Scalper',
      'Korvato Gold Rush'
    ];

    // Find high-traffic indexed pages without promo codes
    const whops = await productionDb.whop.findMany({
      where: {
        indexing: 'INDEX'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        PromoCode: {
          select: { id: true }
        }
      }
    });

    const needsPromos = [];
    
    for (const whop of whops) {
      const hasPromoCode = whop.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        whop.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(whop.name.toLowerCase())
      );

      // Only add to legitimate high-traffic courses, not generic pages
      if (isHighTraffic && !hasPromoCode) {
        needsPromos.push(whop);
      }
    }

    console.log(`🎯 Found ${needsPromos.length} high-traffic courses needing fake promo codes:`);
    needsPromos.forEach(whop => console.log(`   • ${whop.name}`));

    if (needsPromos.length === 0) {
      console.log('✅ All high-traffic courses already have promo codes!');
      return;
    }

    console.log('\n🔥 Creating believable fake promo codes for legitimate courses...');

    // Generate realistic promo codes for each course
    const promoTemplates = [
      { type: 'EXCLUSIVE_ACCESS', valueRange: [15, 25], codes: ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15'] },
      { type: 'LIMITED_TIME', valueRange: [10, 30], codes: ['LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10'] },
      { type: 'DISCOUNT', valueRange: [20, 40], codes: ['DISCOUNT30', 'SAVE25', 'OFF20', 'DEAL35', 'PROMO40'] }
    ];

    let addedCount = 0;

    for (const whop of needsPromos) {
      // Choose random template
      const template = promoTemplates[Math.floor(Math.random() * promoTemplates.length)];
      
      // Generate realistic discount value
      const minVal = template.valueRange[0];
      const maxVal = template.valueRange[1];
      const discountValue = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      
      // Choose realistic promo code
      const promoCode = template.codes[Math.floor(Math.random() * template.codes.length)];
      
      // Create believable title and description
      const courseName = whop.name;
      const title = `${discountValue}% Off ${courseName}`;
      const description = `Get exclusive ${discountValue}% discount on ${courseName}. Limited time offer for new members.`;

      try {
        await productionDb.promoCode.create({
          data: {
            id: uuidv4(),
            title: title,
            description: description,
            code: promoCode,
            type: template.type,
            value: discountValue.toString(),
            whopId: whop.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        console.log(`✅ Added to "${whop.name}": ${promoCode} (${discountValue}% off)`);
        addedCount++;
        
      } catch (error) {
        console.log(`❌ Failed to add promo to "${whop.name}": ${error.message}`);
      }
    }

    console.log(`\n🎉 SUCCESS! Added ${addedCount} fake promo codes to PRODUCTION`);

    // Final verification
    const finalCheck = await productionDb.whop.findMany({
      where: {
        indexing: 'INDEX'
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            PromoCode: true
          }
        }
      }
    });

    console.log('\n📊 FINAL STATUS - PRODUCTION DATABASE:');
    let withPromos = 0;
    let withoutPromos = 0;

    finalCheck.forEach(whop => {
      const hasPromo = whop._count.PromoCode > 0;
      if (hasPromo) {
        withPromos++;
      } else {
        withoutPromos++;
        console.log(`   ❌ ${whop.name} (0 promo codes) - Generic page, OK`);
      }
    });

    console.log(`\n📈 PRODUCTION SUMMARY:`);
    console.log(`   ✅ Indexed pages WITH promo codes: ${withPromos}`);
    console.log(`   ❌ Indexed pages WITHOUT promo codes: ${withoutPromos} (generic pages)`);
    console.log(`   📊 Total indexed pages: ${finalCheck.length}`);

  } catch (error) {
    console.error('❌ Error adding fake promo codes to production:', error);
  } finally {
    await productionDb.$disconnect();
  }
}

addFakePromosToProduction();