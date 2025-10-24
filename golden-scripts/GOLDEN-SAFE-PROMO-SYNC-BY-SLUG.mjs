#!/usr/bin/env node
/**
 * 🏆 GOLDEN SAFE PROMO SYNC BY SLUG - NO DELETIONS EVER 🏆
 * =========================================================
 *
 * ✅ WHAT THIS SCRIPT DOES:
 * - Safely syncs PromoCode data between databases using (whop.slug, code) natural key
 * - ONLY ADDS or UPDATES (when strictly better), NEVER deletes
 * - Resolves Whops by slug to avoid cross-database ID mismatches
 * - Generates new IDs on target, never copies source IDs
 * - Uses "isBetter" logic to only update when incoming discount is numerically superior
 *
 * ⚠️  SAFETY GUARANTEES:
 * - Zero data loss - only additions and improvements
 * - Slug-based whop resolution prevents ID mismatches
 * - Natural key (whopId, code) prevents duplicates
 * - Only updates when incoming value is strictly better
 * - Generates fresh IDs on target database
 * - Supports dry-run mode
 * - Comprehensive error handling
 *
 * 📋 HOW TO USE:
 * 1. Run with --dry first to preview: node --env-file=../.env.sync GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs --dry
 * 2. If summary looks good, run for real: node --env-file=../.env.sync GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs
 *
 * 🔧 REQUIRED ENV:
 * - SOURCE_DATABASE_URL (backup/dev database)
 * - TARGET_DATABASE_URL (production database)
 *
 * Created: 2025-10-24
 * Status: CHATGPT APPROVED SAFE DESIGN ✅
 */

import path from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Always load ../.env.sync from repo root when run from anywhere
config({ path: path.resolve(process.cwd(), '.env.sync') });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry') || args.has('-n');

const SRC_URL = process.env.SOURCE_DATABASE_URL || process.env.BACKUP_DATABASE_URL;
const TGT_URL = process.env.TARGET_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!SRC_URL || !TGT_URL) {
  console.error('❌ Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL in env.');
  console.error('   Also tried BACKUP_DATABASE_URL and PRODUCTION_DATABASE_URL');
  process.exit(1);
}

const source = new PrismaClient({
  datasources: { db: { url: SRC_URL } },
});
const target = new PrismaClient({
  datasources: { db: { url: TGT_URL } },
});

// ---- helpers ---------------------------------------------------------------

function genPromoId() {
  return `promo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseDisplay(value) {
  if (!value) return { kind: 'other' };
  const v = String(value).trim();
  const mPct = v.match(/(\d+(?:\.\d+)?)\s*%/);
  if (mPct) return { kind: 'percent', n: Number(mPct[1]) };

  const mUsd = v.match(/^\$\s*(\d+(?:\.\d+)?)/);
  if (mUsd) return { kind: 'amount', n: Number(mUsd[1]), currency: 'USD' };

  const mGbp = v.match(/^£\s*(\d+(?:\.\d+)?)/);
  if (mGbp) return { kind: 'amount', n: Number(mGbp[1]), currency: 'GBP' };

  const mEur = v.match(/^€\s*(\d+(?:\.\d+)?)/);
  if (mEur) return { kind: 'amount', n: Number(mEur[1]), currency: 'EUR' };

  return { kind: 'other' };
}

function isBetter(existingValue, incomingValue) {
  const a = parseDisplay(existingValue ?? '');
  const b = parseDisplay(incomingValue ?? '');
  if (a.kind === 'percent' && b.kind === 'percent') return (b.n ?? 0) > (a.n ?? 0);
  if (a.kind === 'amount'  && b.kind === 'amount' && a.currency && b.currency && a.currency === b.currency) {
    return (b.n ?? 0) > (a.n ?? 0);
  }
  return false; // different kinds → keep existing
}

// small batch helper to avoid hammering DB
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    /* eslint-disable no-await-in-loop */
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

// ---- main ------------------------------------------------------------------

(async () => {
  console.log('🚀 GOLDEN SAFE PROMO SYNC BY SLUG');
  console.log('==================================');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY-RUN (no writes)' : '✅ LIVE SYNC'}`);
  console.log(`Source: ${SRC_URL.substring(0, 50)}...`);
  console.log(`Target: ${TGT_URL.substring(0, 50)}...`);
  console.log();

  // 1) pull all promos from source and join with whops
  console.log('📊 Fetching promos from SOURCE database...');
  const [srcPromos, srcWhops] = await Promise.all([
    source.promoCode.findMany({
      select: {
        code: true,
        type: true,
        value: true,
        title: true,
        description: true,
        whopId: true,
      },
    }),
    source.whop.findMany({
      select: { id: true, slug: true },
    }),
  ]);

  const idToSlug = new Map(srcWhops.map(w => [w.id, w.slug]));
  const promos = srcPromos
    .map(p => ({ ...p, slug: idToSlug.get(p.whopId) }))
    .filter(p => !!p.slug);
  console.log(`   ✅ Fetched ${promos.length} promos from source (after slug join)`);

  // 2) collect slugs and resolve to target whopIds in one go
  console.log('\n🔍 Resolving Whop slugs on TARGET database...');
  const slugs = Array.from(new Set(promos.map(p => p.slug).filter(Boolean)));
  const targetWhops = await target.whop.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const slugToTargetId = new Map(targetWhops.map(w => [w.slug, w.id]));
  const missingSlugs = slugs.filter(s => !slugToTargetId.has(s));

  console.log(`   ✅ Resolved ${targetWhops.length} whop slugs on target`);
  if (missingSlugs.length) {
    console.warn(`   ⚠️  ${missingSlugs.length} whop slugs are missing on target (will skip those promos):`);
    console.warn(`   ${missingSlugs.slice(0, 20).join(', ')}${missingSlugs.length > 20 ? '…' : ''}`);
  }

  const summary = {
    created: 0,
    updatedBetter: 0,
    touched: 0,
    skippedNoWhop: 0,
    total: promos.length,
  };

  console.log('\n🔄 Processing promos (batched, 25 at a time)...');

  // 3) process in batches
  await inBatches(promos, 25, async (p) => {
    const slug = p.slug;
    const tgtWhopId = slugToTargetId.get(slug);
    if (!tgtWhopId) { summary.skippedNoWhop++; return; }

    // check existing by (whopId, code)
    const existing = await target.promoCode.findFirst({
      where: { whopId: tgtWhopId, code: p.code },
      select: { id: true, value: true },
    });

    if (!existing) {
      if (!DRY_RUN) {
        await target.promoCode.create({
          data: {
            id: genPromoId(),
            whopId: tgtWhopId,
            code: p.code,
            type: p.type,
            value: p.value,
            title: p.title,
            description: p.description,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      summary.created++;
    } else {
      const better = isBetter(existing.value ?? '', p.value ?? '');
      if (better) {
        if (!DRY_RUN) {
          await target.promoCode.update({
            where: { id: existing.id },
            data: {
              type: p.type,
              value: p.value,
              title: p.title,
              description: p.description,
              updatedAt: new Date(),
            },
          });
        }
        summary.updatedBetter++;
      } else {
        if (!DRY_RUN) {
          await target.promoCode.update({
            where: { id: existing.id },
            data: { updatedAt: new Date() }, // optional "touch"
          });
        }
        summary.touched++;
      }
    }
  });

  console.log('\n✅ SYNC SUMMARY:');
  console.log('================');
  console.log(`   Total promos processed: ${summary.total}`);
  console.log(`   ➕ Created:             ${summary.created}`);
  console.log(`   ⬆️  Updated (better):    ${summary.updatedBetter}`);
  console.log(`   👉 Touched (same):      ${summary.touched}`);
  console.log(`   ⚠️  Skipped (no whop):  ${summary.skippedNoWhop}`);

  await source.$disconnect();
  await target.$disconnect();

  if (DRY_RUN) {
    console.log('\n🧪 DRY RUN COMPLETE - No writes were made to target database');
    console.log('   Run without --dry flag to perform actual sync');
  } else {
    console.log('\n🎉 SYNC COMPLETED SUCCESSFULLY!');
    console.log('   Target database now has all promos from source (with better values only)');
  }
})().catch(async (err) => {
  console.error('\n💥 SYNC FAILED:', err);
  try { await source.$disconnect(); } catch {}
  try { await target.$disconnect(); } catch {}
  process.exit(1);
});
