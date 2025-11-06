#!/usr/bin/env node
/**
 * Reconcile promo whop totals:
 *  - Fetch total promo whops from DB
 *  - Subtract manual-content whops (33)
 *  - Compare to checkpoint (done + rejected)
 *  - Print exact difference and mismatches
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  // 1. Get definitive number of promo-code whops from DB
  const promoCount = await prisma.whop.count({
    where: { PromoCode: { some: {} } },
  });

  // 2. Manual-content promo count (user confirmed = 33)
  const manualContentCount = 33;

  // 3. Load checkpoint
  const ck = JSON.parse(fs.readFileSync('data/content/.checkpoint.json', 'utf8'));
  const done = Object.keys(ck.done || {}).length;
  const rejected = Object.keys(ck.rejected || {}).length;
  const totalTracked = done + rejected;

  // 4. Expected = promoCount - manualContentCount
  const expected = promoCount - manualContentCount;

  // 5. Compare and print
  console.log('=== PROMO RECONCILIATION REPORT ===');
  console.log(`Promo whops in DB:          ${promoCount}`);
  console.log(`Manual-content promos:       ${manualContentCount}`);
  console.log(`Expected AI-generated count: ${expected}`);
  console.log('');
  console.log(`Checkpoint done:             ${done}`);
  console.log(`Checkpoint rejected:         ${rejected}`);
  console.log(`Checkpoint total:            ${totalTracked}`);
  console.log('');
  const diff = totalTracked - expected;
  if (diff === 0) {
    console.log('✅ Perfect match: totals reconcile exactly.');
  } else if (diff > 0) {
    console.log(`⚠️ ${diff} EXTRA items tracked in checkpoint (possible duplicates or data drift).`);
  } else {
    console.log(`⚠️ ${Math.abs(diff)} MISSING items (some promos never processed).`);
  }

  // 6. Find which tracked items are no longer promo in DB
  const allTracked = Object.keys({ ...ck.done, ...ck.rejected });
  const promoSlugs = new Set(
    (await prisma.whop.findMany({ where: { PromoCode: { some: {} } }, select: { slug: true } }))
    .map(r => r.slug)
  );
  const nonPromoTracked = allTracked.filter(s => !promoSlugs.has(s));

  if (nonPromoTracked.length) {
    console.log(`\n⚠️ ${nonPromoTracked.length} tracked items are no longer promo in DB.`);
    fs.writeFileSync('/tmp/non-promo-tracked.txt', nonPromoTracked.join('\n'));
    console.log('List saved to /tmp/non-promo-tracked.txt');
  }

  // 7. Find which current promo whops are NOT tracked at all
  const trackedSet = new Set(allTracked);
  const untrackedPromos = (await prisma.whop.findMany({
    where: { PromoCode: { some: {} } },
    select: { slug: true }
  })).map(r => r.slug).filter(s => !trackedSet.has(s));

  if (untrackedPromos.length) {
    console.log(`\n⚠️ ${untrackedPromos.length} current promo whops are NOT in checkpoint at all.`);
    fs.writeFileSync('/tmp/untracked-promos.txt', untrackedPromos.join('\n'));
    console.log('List saved to /tmp/untracked-promos.txt');
    console.log('First 20:');
    console.log(untrackedPromos.slice(0, 20).join('\n'));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
