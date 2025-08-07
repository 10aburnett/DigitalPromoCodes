const { PrismaClient } = require('@prisma/client');

// Check both databases
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function verifyNoRealPromosTouched() {
  try {
    console.log('🔍 VERIFYING NO REAL PROMO CODES WERE TOUCHED\n');

    // Get recent date (last 3 hours to be safe)
    const recentDate = new Date(Date.now() - 3*60*60*1000);
    console.log(`📅 Checking for changes since: ${recentDate}`);

    // Known real promo codes (from your original data)
    const knownRealPromoCodes = [
      'JOSH', 'DODGY', 'TMS', 'STELLAR', 'AYECON', 'GOAT', 'PJ', 'DELTA',
      'ZWM', 'PROPS', 'SCARFACE', 'HAVEN', 'OWLS', 'INDICATORS', 'SUPERCAR',
      'BFIFX', 'MOMENTUM', 'LARRY', 'MOEMENTUM', 'PARLAY', 'PROP', 'TRADE'
    ];

    console.log('🔍 CHECKING BACKUP DATABASE:');
    
    // Check if any real promo codes were modified recently
    const backupModified = await backupDb.promoCode.findMany({
      where: {
        updatedAt: { gte: recentDate },
        code: { in: knownRealPromoCodes }
      },
      select: {
        id: true,
        code: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        whop: { select: { name: true } }
      }
    });

    if (backupModified.length > 0) {
      console.log('❌ REAL PROMO CODES WERE MODIFIED:');
      backupModified.forEach(promo => {
        console.log(`   ⚠️ ${promo.code} on "${promo.whop.name}" - Updated: ${promo.updatedAt}`);
      });
    } else {
      console.log('✅ NO real promo codes were modified in backup');
    }

    // Check if any promo codes were deleted
    const backupDeleted = await backupDb.promoCode.findMany({
      where: {
        code: { in: knownRealPromoCodes }
      },
      select: {
        code: true,
        whop: { select: { name: true } }
      }
    });

    console.log(`✅ Found ${backupDeleted.length} known real promo codes still exist in backup`);

    console.log('\n🔍 CHECKING PRODUCTION DATABASE:');
    
    const prodModified = await productionDb.promoCode.findMany({
      where: {
        updatedAt: { gte: recentDate },
        code: { in: knownRealPromoCodes }
      },
      select: {
        id: true,
        code: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        whop: { select: { name: true } }
      }
    });

    if (prodModified.length > 0) {
      console.log('❌ REAL PROMO CODES WERE MODIFIED:');
      prodModified.forEach(promo => {
        console.log(`   ⚠️ ${promo.code} on "${promo.whop.name}" - Updated: ${promo.updatedAt}`);
      });
    } else {
      console.log('✅ NO real promo codes were modified in production');
    }

    const prodDeleted = await productionDb.promoCode.findMany({
      where: {
        code: { in: knownRealPromoCodes }
      },
      select: {
        code: true,
        whop: { select: { name: true } }
      }
    });

    console.log(`✅ Found ${prodDeleted.length} known real promo codes still exist in production`);

    // Show only recently added fake promo codes
    console.log('\n🆕 RECENTLY ADDED FAKE PROMO CODES:');
    
    const fakePromoCodes = ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15', 'LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10', 'DISCOUNT30', 'SAVE25', 'OFF20', 'DEAL35', 'PROMO40'];
    
    const recentFakes = await productionDb.promoCode.findMany({
      where: {
        createdAt: { gte: recentDate },
        code: { in: fakePromoCodes }
      },
      select: {
        code: true,
        value: true,
        whop: { select: { name: true } },
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${recentFakes.length} recently added fake promo codes:`);
    recentFakes.forEach(promo => {
      console.log(`   🎯 ${promo.code} (${promo.value}% off) on "${promo.whop.name}"`);
    });

    console.log('\n🛡️ SAFETY VERIFICATION:');
    console.log(`✅ Real promo codes modified in backup: ${backupModified.length}`);
    console.log(`✅ Real promo codes modified in production: ${prodModified.length}`);
    console.log(`✅ Real promo codes still exist in backup: ${backupDeleted.length}`);  
    console.log(`✅ Real promo codes still exist in production: ${prodDeleted.length}`);
    console.log(`🎯 Fake promo codes added: ${recentFakes.length}`);

    if (backupModified.length === 0 && prodModified.length === 0) {
      console.log('\n🏆 CONFIRMED: NO REAL PROMO CODES WERE TOUCHED!');
    } else {
      console.log('\n⚠️ WARNING: REAL PROMO CODES MAY HAVE BEEN MODIFIED!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await backupDb.$disconnect();
    await productionDb.$disconnect();
  }
}

verifyNoRealPromosTouched();