#!/usr/bin/env node
/**
 * scripts/verify-promo-slugs.mjs
 *
 * Verifies that all provided slugs have at least one promo code in the DB.
 * Aborts with exit code 3 if any slug is non-promo or missing.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const slugs = (process.argv[2] || '').split(',').map(s => s.trim()).filter(Boolean);

if (!slugs.length) {
  console.error('❌ No slugs provided to verify');
  process.exit(2);
}

try {
  const rows = await prisma.whop.findMany({
    where: { slug: { in: slugs } },
    select: {
      slug: true,
      _count: { select: { PromoCode: true } }
    }
  });

  const bad = rows.filter(r => r._count.PromoCode < 1).map(r => r.slug);
  const missing = slugs.filter(s => !rows.find(r => r.slug === s));

  if (bad.length || missing.length) {
    console.error(`❌ Non-promo or missing slugs detected:`);
    if (bad.length) console.error(`  Non-promo (no promo codes): ${bad.join(', ')}`);
    if (missing.length) console.error(`  Missing from DB: ${missing.join(', ')}`);
    await prisma.$disconnect();
    process.exit(3);
  }

  console.log(`✅ Verified ${slugs.length} promo slugs - all have promo codes`);
  await prisma.$disconnect();
  process.exit(0);
} catch (err) {
  console.error('❌ Verification failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
}
