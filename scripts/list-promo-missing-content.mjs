#!/usr/bin/env node
/**
 * List promo-code whops that DO NOT have sufficient content IN THE DATABASE.
 *
 * Output:
 *  - Prints a summary + sample to stdout
 *  - Writes CSV of slugs to: /tmp/promo-missing-db.csv
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const stripHtml = (s) =>
  typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

/** True if DB content looks complete enough to skip generation */
function hasSufficientContent(w) {
  const aboutOK = stripHtml(w.aboutContent).length >= 80;

  const hasLi = (s) => typeof s === 'string' && /<li/i.test(s);
  const redeemOK = hasLi(w.howToRedeemContent);
  const promoOK  = hasLi(w.promoDetailsContent);
  const termsOK  = hasLi(w.termsContent);

  // faqContent can be array OR JSON string in your DB
  let faqArray = w.faqContent;
  if (typeof faqArray === 'string' && faqArray.trim()) {
    try { faqArray = JSON.parse(faqArray); } catch { faqArray = []; }
  }
  const faqOK = Array.isArray(faqArray) && faqArray.length >= 3;

  return aboutOK && redeemOK && promoOK && termsOK && faqOK;
}

async function main() {
  // 1) Pull ONLY promo whops from DB (ground truth)
  const promoWhops = await prisma.whop.findMany({
    where: { PromoCode: { some: {} } },
    select: {
      slug: true,
      name: true,
      aboutContent: true,
      howToRedeemContent: true,
      promoDetailsContent: true,
      termsContent: true,
      faqContent: true,
    },
  });

  const totalPromo = promoWhops.length;

  // 2) Partition by content sufficiency
  const missing = [];
  const complete = [];

  for (const w of promoWhops) {
    if (hasSufficientContent(w)) complete.push(w.slug);
    else missing.push(w.slug);
  }

  // 3) Save CSV of missing
  const outCsv = '/tmp/promo-missing-db.csv';
  fs.writeFileSync(outCsv, missing.join(',') + (missing.length ? '\n' : ''));

  // 4) Print summary
  console.log('=== PROMO CONTENT AUDIT (DB truth) ===');
  console.log(`Promo whops in DB:          ${totalPromo}`);
  console.log(`With sufficient content:     ${complete.length}`);
  console.log(`Missing/insufficient:        ${missing.length}`);
  console.log('');
  if (missing.length) {
    console.log('Sample missing (up to 20):');
    console.log(missing.slice(0, 20).join('\n'));
    if (missing.length > 20) {
      console.log(`... and ${missing.length - 20} more`);
    }
  } else {
    console.log('✅ All promo whops have sufficient content in the database!');
  }
  console.log('');
  console.log(`CSV written: ${outCsv}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
