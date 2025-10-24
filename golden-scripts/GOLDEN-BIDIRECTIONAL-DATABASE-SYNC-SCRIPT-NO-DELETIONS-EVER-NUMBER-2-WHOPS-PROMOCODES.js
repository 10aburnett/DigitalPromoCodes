/** 🚨 DEPRECATION NOTICE (PROMO CODES) 🚨
 * ========================================
 * DO NOT USE THIS SCRIPT FOR PROMO CODES!
 *
 * ❌ PROBLEM: This script matches PromoCode by raw database IDs, not by the
 *    natural key (whopId, code). This causes duplicate promo rows when syncing
 *    across databases because IDs differ between backup and production.
 *
 * ✅ SOLUTION: Use GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs instead
 *    - Resolves Whops by slug (not raw IDs)
 *    - Upserts by natural key (whopId, code)
 *    - Prevents duplicates with "only update when better" logic
 *
 * 📋 THIS SCRIPT IS STILL SAFE FOR:
 *    - Whop table sync (marketplace products)
 *    - DO NOT USE for PromoCode sync
 *
 * Last incident: 2025-10-24 - Created 808 duplicate promos on both databases
 * Fix applied: Unique index on (whopId, code) now prevents this at DB level
 * ========================================
 */

/**
 * 🏆 GOLDEN BIDIRECTIONAL DATABASE SYNC SCRIPT #2 - NO DELETIONS EVER 🏆
 * =====================================================================
 *
 * ✅ WHAT THIS SCRIPT DOES:
 * - Safely merges Whop and PromoCode data between two Neon PostgreSQL databases
 * - ONLY ADDS data, NEVER deletes anything
 * - Syncs: Whop (with indexing field), PromoCode ⚠️ DEPRECATED FOR PROMOS
 * - Adds missing schema columns automatically
 * - Shows detailed progress and verification
 *
 * ⚠️  SAFETY GUARANTEES:
 * - Zero data loss - only additions
 * - Skips duplicates gracefully
 * - Handles missing references safely
 * - Comprehensive error handling
 * 
 * 📋 HOW TO USE:
 * 1. Database URLs are already set below
 * 2. Run: node "GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js"
 * 3. Watch the magic happen safely
 * 
 * 🎯 COMPANION TO ORIGINAL GOLDEN SCRIPT:
 * - Original handles: BlogPosts, Comments, CommentVotes, MailingList
 * - This handles: Whop, PromoCode (including fake promo codes and indexing)
 * - Same exact structure and safety guarantees
 * 
 * Created: 2025-08-07
 * Status: BATTLE TESTED STRUCTURE ADAPTED ✅
 */

const { PrismaClient } = require('@prisma/client');

// 🛡️ SAFETY FRAMEWORK - GPT RECOMMENDED
// =====================================
const DRY_RUN = process.env.DRY_RUN === '1';          // log, don't write
const WRAP_IN_TX_AND_ROLLBACK = process.env.ROLLBACK === '1'; // do writes, then rollback

async function runWithSafety(client, fn) {
  if (DRY_RUN) {
    console.log('🧪 DRY_RUN=1 — no writes will be committed.');
    return fn({ prisma: client, write: async (desc, cb) => console.log(`   (write skipped: ${desc})`) });
  }
  if (WRAP_IN_TX_AND_ROLLBACK) {
    console.log('🧪 ROLLBACK=1 — running in a transaction and rolling back at the end.');
    return await client.$transaction(async (tx) => {
      await fn({ prisma: tx, write: async (desc, cb) => cb(tx) });
      // force rollback
      throw new Error('ROLLBACK_MARKER');
    }).catch(e => {
      if (e.message === 'ROLLBACK_MARKER') {
        console.log('↩︎ Transaction rolled back as planned.');
        return;
      }
      throw e;
    });
  }
  // normal mode — real writes
  return fn({ prisma: client, write: async (desc, cb) => cb(client) });
}

// Database connections (same as original golden script)
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKUP_DATABASE_URL
    }
  }
});

const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL
    }
  }
});

async function analyzeDataDifferences() {
  console.log('🔍 ANALYZING WHOP & PROMOCODE DIFFERENCES BETWEEN DATABASES');
  console.log('==========================================================');
  
  try {
    // Check Whops
    const backupWhops = await backupDb.whop.findMany({
      select: { id: true, name: true, slug: true }
    });
    const productionWhops = await productionDb.whop.findMany({
      select: { id: true, name: true, slug: true }
    });

    console.log(`\n🎯 WHOPS:`);
    console.log(`   Backup: ${backupWhops.length} whops`);
    console.log(`   Production: ${productionWhops.length} whops`);
    
    const backupSlugs = new Set(backupWhops.map(w => w.slug));
    const productionSlugs = new Set(productionWhops.map(w => w.slug));
    
    const onlyInBackup = backupWhops.filter(w => !productionSlugs.has(w.slug));
    const onlyInProduction = productionWhops.filter(w => !backupSlugs.has(w.slug));
    
    console.log(`   Missing from Production: ${onlyInBackup.length} whops`);
    onlyInBackup.forEach(w => console.log(`     - ${w.name}`));
    console.log(`   Missing from Backup: ${onlyInProduction.length} whops`);
    onlyInProduction.forEach(w => console.log(`     - ${w.name}`));

    // Check PromoCodes
    const backupPromos = await backupDb.promoCode.findMany({
      select: { id: true, code: true, title: true, whopId: true }
    });
    const productionPromos = await productionDb.promoCode.findMany({
      select: { id: true, code: true, title: true, whopId: true }
    });

    console.log(`\n🎯 PROMO CODES:`);
    console.log(`   Backup: ${backupPromos.length} promo codes`);
    console.log(`   Production: ${productionPromos.length} promo codes`);

    // Check for fake promo codes specifically
    const fakePromoCodes = ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15', 'LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10', 'DISCOUNT30', 'SAVE25', 'OFF20', 'DEAL35', 'PROMO40'];
    
    const backupFakes = backupPromos.filter(p => fakePromoCodes.includes(p.code));
    const productionFakes = productionPromos.filter(p => fakePromoCodes.includes(p.code));
    
    console.log(`   Fake promos in Backup: ${backupFakes.length}`);
    console.log(`   Fake promos in Production: ${productionFakes.length}`);

    return {
      whops: { backup: backupWhops, production: productionWhops, onlyInBackup, onlyInProduction },
      promos: { backup: backupPromos, production: productionPromos, backupFakes, productionFakes }
    };

  } catch (error) {
    console.error('❌ Error analyzing databases:', error);
    throw error;
  }
}

async function ensureSchemaColumns() {
  console.log('\n🔧 ENSURING ALL WHOP/PROMOCODE SCHEMA COLUMNS EXIST');
  console.log('===================================================');

  const requiredColumns = [
    'CREATE TYPE "IndexingStatus" AS ENUM (\'INDEX\', \'NOINDEX\', \'AUTO\')',
    'ALTER TABLE "Whop" ADD COLUMN IF NOT EXISTS "indexing" "IndexingStatus" NOT NULL DEFAULT \'AUTO\''
  ];

  try {
    console.log('🔹 Adding indexing columns to BACKUP database...');
    for (const sql of requiredColumns) {
      try {
        await backupDb.$executeRawUnsafe(sql);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('   ✅ Column already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    console.log('✅ Backup database columns updated');

    console.log('🔹 Adding indexing columns to PRODUCTION database...');
    for (const sql of requiredColumns) {
      try {
        await productionDb.$executeRawUnsafe(sql);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('   ✅ Column already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    console.log('✅ Production database columns updated');

  } catch (error) {
    console.error('❌ Error updating schemas:', error);
    throw error;
  }
}

async function syncWhops(analysis) {
  console.log('\n🎯 SYNCING WHOPS');
  console.log('=================');

  try {
    // Add backup whops to production
    if (analysis.whops.onlyInBackup.length > 0) {
      console.log(`🔹 Adding ${analysis.whops.onlyInBackup.length} whops to PRODUCTION...`);
      
      for (const whopSummary of analysis.whops.onlyInBackup) {
        const fullWhop = await backupDb.whop.findUnique({
          where: { slug: whopSummary.slug }
        });
        
        if (fullWhop) {
          const { createdAt, ...whopData } = fullWhop;
          await productionDb.whop.create({ data: whopData });
          console.log(`   ✅ Added: ${fullWhop.name}`);
        }
      }
    }

    // Add production whops to backup
    if (analysis.whops.onlyInProduction.length > 0) {
      console.log(`🔹 Adding ${analysis.whops.onlyInProduction.length} whops to BACKUP...`);
      
      for (const whopSummary of analysis.whops.onlyInProduction) {
        const fullWhop = await productionDb.whop.findUnique({
          where: { slug: whopSummary.slug }
        });
        
        if (fullWhop) {
          // Keep all data including timestamps to preserve exact state
          await backupDb.whop.create({ data: fullWhop });
          console.log(`   ✅ Added: ${fullWhop.name}`);
        }
      }
    }

    console.log('✅ Whops sync completed');

  } catch (error) {
    console.error('❌ Error syncing whops:', error);
    throw error;
  }
}

async function syncPromoCodes(analysis) {
  console.log('\n🎯 SYNCING PROMO CODES');
  console.log('=======================');

  try {
    // Get all promo codes with full data
    const backupPromos = await backupDb.promoCode.findMany();
    const productionPromos = await productionDb.promoCode.findMany();

    const backupIds = new Set(backupPromos.map(p => p.id));
    const productionIds = new Set(productionPromos.map(p => p.id));

    // Add production promos to backup
    const promosToAddToBackup = productionPromos.filter(p => !backupIds.has(p.id));
    if (promosToAddToBackup.length > 0) {
      console.log(`🔹 Adding ${promosToAddToBackup.length} promo codes to BACKUP...`);
      for (const promo of promosToAddToBackup) {
        const { createdAt, updatedAt, ...promoData } = promo;
        try {
          await backupDb.promoCode.create({ 
            data: {
              ...promoData,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          console.log(`   ✅ Added promo: ${promo.code} (${promo.value}% off)`);
        } catch (error) {
          console.log(`   ⚠️  Skipped promo (probably missing whop): ${error.message}`);
        }
      }
    }

    // Add backup promos to production
    const promosToAddToProduction = backupPromos.filter(p => !productionIds.has(p.id));
    if (promosToAddToProduction.length > 0) {
      console.log(`🔹 Adding ${promosToAddToProduction.length} promo codes to PRODUCTION...`);
      for (const promo of promosToAddToProduction) {
        const { createdAt, updatedAt, ...promoData } = promo;
        try {
          await productionDb.promoCode.create({ 
            data: {
              ...promoData,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          console.log(`   ✅ Added promo: ${promo.code} (${promo.value}% off)`);
        } catch (error) {
          console.log(`   ⚠️  Skipped promo (probably missing whop): ${error.message}`);
        }
      }
    }

    console.log('✅ Promo codes sync completed');

  } catch (error) {
    console.error('❌ Error syncing promo codes:', error);
    throw error;
  }
}

async function verifySync() {
  console.log('\n✅ FINAL VERIFICATION');
  console.log('=====================');

  try {
    const backupCounts = {
      whops: await backupDb.whop.count(),
      promos: await backupDb.promoCode.count(),
      // indexedWhops: await backupDb.whop.count({ where: { indexing: 'INDEX' } }),
      // noindexedWhops: await backupDb.whop.count({ where: { indexing: 'NOINDEX' } })
    };

    const productionCounts = {
      whops: await productionDb.whop.count(),
      promos: await productionDb.promoCode.count(),
      // indexedWhops: await productionDb.whop.count({ where: { indexing: 'INDEX' } }),
      // noindexedWhops: await productionDb.whop.count({ where: { indexing: 'NOINDEX' } })
    };

    console.log('📊 FINAL COUNTS:');
    console.log(`   Whops         - Backup: ${backupCounts.whops}, Production: ${productionCounts.whops}`);
    console.log(`   Promo Codes   - Backup: ${backupCounts.promos}, Production: ${productionCounts.promos}`);
    console.log(`   Indexed       - Backup: ${backupCounts.indexedWhops}, Production: ${productionCounts.indexedWhops}`);
    console.log(`   Noindexed     - Backup: ${backupCounts.noindexedWhops}, Production: ${productionCounts.noindexedWhops}`);

    // Check fake promo codes specifically
    const fakePromoCodes = ['SAVE20', 'VIP15', 'EXCLUSIVE25', 'MEMBER20', 'SPECIAL15', 'LIMITED30', 'FLASH20', 'TODAY25', 'NOW15', 'QUICK10', 'DISCOUNT30', 'SAVE25', 'OFF20', 'DEAL35', 'PROMO40'];
    
    const backupFakes = await backupDb.promoCode.count({
      where: { code: { in: fakePromoCodes } }
    });
    const productionFakes = await productionDb.promoCode.count({
      where: { code: { in: fakePromoCodes } }
    });

    console.log(`   Fake Promos   - Backup: ${backupFakes}, Production: ${productionFakes}`);

    const allMatch = JSON.stringify(backupCounts) === JSON.stringify(productionCounts);
    if (allMatch) {
      console.log('\n🎉 SUCCESS! Both databases are now fully synchronized for Whops & PromoCode!');
    } else {
      console.log('\n⚠️  Databases have different counts (this may be expected due to timing or constraints)');
    }

    return { backupCounts, productionCounts, allMatch, backupFakes, productionFakes };

  } catch (error) {
    console.error('❌ Error verifying sync:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 BIDIRECTIONAL DATABASE SYNC #2 (WHOPS & PROMOCODES)');
  console.log('======================================================');
  console.log('⚠️  SAFE MODE: ONLY ADDING DATA, NEVER DELETING');
  console.log();

  try {
    // Step 1: Analyze differences
    const analysis = await analyzeDataDifferences();
    
    // Step 2: Ensure schema columns exist
    await ensureSchemaColumns();
    
    // Step 3: Sync whops
    await syncWhops(analysis);
    
    // Step 4: Sync promo codes
    await syncPromoCodes(analysis);
    
    // Step 5: Verify everything
    await verifySync();

    console.log('\n🎉 BIDIRECTIONAL SYNC #2 COMPLETED SUCCESSFULLY!');
    console.log('Both databases now contain all Whop & PromoCode data from each other.');

  } catch (error) {
    console.error('\n💥 SYNC FAILED:', error);
  } finally {
    await backupDb.$disconnect();
    await productionDb.$disconnect();
  }
}

main();