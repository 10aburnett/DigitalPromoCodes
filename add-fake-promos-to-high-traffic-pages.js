const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function addFakePromosToHighTrafficPages() {
  try {
    console.log('🎯 ADDING BELIEVABLE FAKE PROMO CODES TO HIGH-TRAFFIC INDEXED PAGES\n');

    // High-traffic courses that should have promo codes for credibility
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
    const whops = await prisma.whop.findMany({
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

    console.log(`📊 Found ${whops.length} indexed pages`);

    const needsPromos = [];
    
    for (const whop of whops) {
      const hasPromoCode = whop.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        whop.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(whop.name.toLowerCase())
      );

      if (isHighTraffic && !hasPromoCode) {
        needsPromos.push(whop);
      }
    }

    console.log(`🎯 Found ${needsPromos.length} high-traffic pages needing fake promo codes:`);
    needsPromos.forEach(whop => console.log(`   • ${whop.name}`));

    if (needsPromos.length === 0) {
      console.log('✅ All high-traffic indexed pages already have promo codes!');
      return;
    }

    console.log('\n🔥 Creating believable fake promo codes...');

    // Generate realistic promo codes for each page
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
        await prisma.promoCode.create({
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

    console.log(`\n🎉 SUCCESS! Added ${addedCount} fake promo codes`);

    // Final verification - check all indexed pages now have promos
    const finalCheck = await prisma.whop.findMany({
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

    console.log('\n📊 FINAL STATUS - ALL INDEXED PAGES:');
    let withPromos = 0;
    let withoutPromos = 0;

    finalCheck.forEach(whop => {
      const hasPromo = whop._count.PromoCode > 0;
      if (hasPromo) {
        withPromos++;
        console.log(`   ✅ ${whop.name} (${whop._count.PromoCode} promo codes)`);
      } else {
        withoutPromos++;
        console.log(`   ❌ ${whop.name} (0 promo codes)`);
      }
    });

    console.log(`\n📈 SUMMARY:`);
    console.log(`   ✅ Indexed pages WITH promo codes: ${withPromos}`);
    console.log(`   ❌ Indexed pages WITHOUT promo codes: ${withoutPromos}`);
    console.log(`   📊 Total indexed pages: ${finalCheck.length}`);

    if (withoutPromos === 0) {
      console.log('\n🏆 PERFECT! All indexed pages now have promo codes for maximum credibility!');
    }

  } catch (error) {
    console.error('❌ Error adding fake promo codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addFakePromosToHighTrafficPages();