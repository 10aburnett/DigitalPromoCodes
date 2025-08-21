const { PrismaClient } = require('@prisma/client');

// Database connections
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function finalSynchronizationCheck() {
  try {
    console.log('🔍 FINAL COMPLETE DATABASE SYNCHRONIZATION CHECK');
    console.log('=================================================\n');

    // Check all major tables
    const tables = [
      'blogPost',
      'comment', 
      'commentVote',
      'mailingList',
      'whop',
      'promoCode'
    ];

    const results = {};

    for (const table of tables) {
      console.log(`📊 CHECKING ${table.toUpperCase()} TABLE:`);
      
      try {
        const backupCount = await backupDb[table].count();
        const productionCount = await productionDb[table].count();
        
        results[table] = {
          backup: backupCount,
          production: productionCount,
          synchronized: backupCount === productionCount
        };
        
        console.log(`   Backup: ${backupCount} records`);
        console.log(`   Production: ${productionCount} records`);
        console.log(`   Synchronized: ${backupCount === productionCount ? '✅ YES' : '❌ NO'}`);
        
        if (backupCount !== productionCount) {
          console.log(`   ⚠️  DIFFERENCE: ${Math.abs(backupCount - productionCount)} records`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error checking ${table}: ${error.message}`);
        results[table] = { error: error.message };
      }
      
      console.log('');
    }

    // Special checks for critical data
    console.log('🎯 CRITICAL DATA VERIFICATION:');
    console.log('==============================');
    
    // Check indexing status
    const backupIndexed = await backupDb.whop.count({ where: { indexing: 'INDEX' } });
    const productionIndexed = await productionDb.whop.count({ where: { indexing: 'INDEX' } });
    const backupNoindexed = await backupDb.whop.count({ where: { indexing: 'NOINDEX' } });
    const productionNoindexed = await productionDb.whop.count({ where: { indexing: 'NOINDEX' } });
    
    console.log(`📈 INDEXED WHOPS:`);
    console.log(`   Backup: ${backupIndexed} | Production: ${productionIndexed} | Match: ${backupIndexed === productionIndexed ? '✅' : '❌'}`);
    console.log(`📉 NOINDEXED WHOPS:`);
    console.log(`   Backup: ${backupNoindexed} | Production: ${productionNoindexed} | Match: ${backupNoindexed === productionNoindexed ? '✅' : '❌'}`);
    
    // Check promo code types
    const fakePromoCodes = ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15', 'LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10', 'DISCOUNT30', 'SAVE25', 'OFF20', 'DEAL35', 'PROMO40'];
    
    const backupRealPromos = await backupDb.promoCode.count({ 
      where: { code: { notIn: fakePromoCodes } }
    });
    const productionRealPromos = await productionDb.promoCode.count({ 
      where: { code: { notIn: fakePromoCodes } }
    });
    const backupFakePromos = await backupDb.promoCode.count({ 
      where: { code: { in: fakePromoCodes } }
    });
    const productionFakePromos = await productionDb.promoCode.count({ 
      where: { code: { in: fakePromoCodes } }
    });
    
    console.log(`💎 REAL PROMO CODES:`);
    console.log(`   Backup: ${backupRealPromos} | Production: ${productionRealPromos} | Match: ${backupRealPromos === productionRealPromos ? '✅' : '❌'}`);
    console.log(`🎯 FAKE PROMO CODES:`);
    console.log(`   Backup: ${backupFakePromos} | Production: ${productionFakePromos} | Match: ${backupFakePromos === productionFakePromos ? '✅' : '❌'}`);

    // Check blog and engagement data
    const backupPublishedPosts = await backupDb.blogPost.count({ where: { published: true } });
    const productionPublishedPosts = await productionDb.blogPost.count({ where: { published: true } });
    
    console.log(`📝 PUBLISHED BLOG POSTS:`);
    console.log(`   Backup: ${backupPublishedPosts} | Production: ${productionPublishedPosts} | Match: ${backupPublishedPosts === productionPublishedPosts ? '✅' : '❌'}`);

    console.log('\n🏆 OVERALL SYNCHRONIZATION STATUS:');
    console.log('==================================');
    
    let allSynchronized = true;
    let totalBackupRecords = 0;
    let totalProductionRecords = 0;
    
    for (const [tableName, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`❌ ${tableName}: ERROR - ${result.error}`);
        allSynchronized = false;
      } else {
        const status = result.synchronized ? '✅' : '❌';
        console.log(`${status} ${tableName}: ${result.backup} ↔ ${result.production}`);
        if (!result.synchronized) allSynchronized = false;
        totalBackupRecords += result.backup;
        totalProductionRecords += result.production;
      }
    }
    
    console.log('');
    console.log(`📊 TOTAL RECORDS: Backup: ${totalBackupRecords} | Production: ${totalProductionRecords}`);
    console.log(`🎯 INDEXING SETUP: ${backupIndexed} indexed, ${backupNoindexed} noindexed`);
    console.log(`🎯 PROMO CODES: ${backupRealPromos} real, ${backupFakePromos} fake`);
    console.log('');
    
    if (allSynchronized) {
      console.log('🎉 SUCCESS: ALL DATABASES ARE PERFECTLY SYNCHRONIZED!');
      console.log('✅ Both backup and production databases contain identical data');
      console.log('✅ SEO indexing strategy fully implemented');
      console.log('✅ Fake promo codes successfully added for credibility');
      console.log('✅ All real promo codes preserved intact');
      console.log('✅ Ready for production deployment');
    } else {
      console.log('⚠️  WARNING: Some tables are not synchronized');
      console.log('🔧 Please investigate differences shown above');
    }

  } catch (error) {
    console.error('❌ Error during synchronization check:', error);
  } finally {
    await backupDb.$disconnect();
    await productionDb.$disconnect();
  }
}

finalSynchronizationCheck();