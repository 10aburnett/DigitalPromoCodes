#!/usr/bin/env node
// READ-ONLY: Export slugs that need content generation (any field missing/weak)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const strip = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : '');

function needsContent(whop) {
  const aboutOK = strip(whop.aboutContent).length >= 80;
  const li = (s) => /<li/i.test(s || '');

  // Handle faqContent as either array or JSON string
  let faqArray = whop.faqContent;
  if (typeof faqArray === 'string' && faqArray.trim()) {
    try { faqArray = JSON.parse(faqArray); } catch { faqArray = []; }
  }
  const faqOK = Array.isArray(faqArray) && faqArray.length >= 3;

  return !(
    aboutOK &&
    li(whop.howToRedeemContent) &&
    li(whop.promoDetailsContent) &&
    li(whop.termsContent) &&
    faqOK
  );
}

async function main() {
  const whops = await prisma.deal.findMany({
    select: {
      slug: true,
      aboutContent: true,
      howToRedeemContent: true,
      promoDetailsContent: true,
      termsContent: true,
      faqContent: true
    }
  });

  const needing = whops.filter(needsContent).map(w => w.slug);

  // Output one per line for easier processing
  needing.forEach(slug => console.log(slug));

  console.error(`Found ${needing.length} whops needing content (out of ${whops.length} total)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
