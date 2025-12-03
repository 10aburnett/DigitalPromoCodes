/**
 * Find pages that need full content rewrites:
 * 1. First 37 by display order (originally indexed)
 * 2. Generic/crappy names (likely slipped through indexing)
 */

import { prisma } from '../src/lib/prisma';
import fs from 'fs/promises';

// Generic single-word or low-quality name patterns
const GENERIC_PATTERNS = [
  /^course$/i,
  /^group$/i,
  /^membership$/i,
  /^premium$/i,
  /^vip$/i,
  /^access$/i,
  /^standard$/i,
  /^basic$/i,
  /^pro$/i,
  /^elite$/i,
  /^monthly$/i,
  /^yearly$/i,
  /^annual$/i,
  /^lifetime$/i,
  /^subscription$/i,
  /^plan$/i,
  /^tier$/i,
  /^bundle$/i,
  /^package$/i,
  /^signals$/i,
  /^trading$/i,
  /^community$/i,
  /^discord$/i,
  /^telegram$/i,
];

function isGenericName(name: string): boolean {
  const trimmed = name.trim();

  // STRICT: Only match if the ENTIRE name is a generic pattern
  // No length-based checks - only exact matches of generic terms
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

async function main() {
  await prisma.$connect();

  console.log('📊 Finding pages that need full rewrites...\n');

  // Get first 37 by display order
  const first37 = await prisma.deal.findMany({
    orderBy: { displayOrder: 'asc' },
    take: 37,
    select: { slug: true, name: true, displayOrder: true },
  });

  console.log('=== FIRST 37 BY DISPLAY ORDER ===');
  console.log('(These were originally indexed)\n');
  for (const d of first37) {
    console.log('  ' + d.displayOrder + '. ' + d.name + ' (' + d.slug + ')');
  }

  // Get all deals to check for generic names
  const allDeals = await prisma.deal.findMany({
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });

  const genericDeals = allDeals.filter(d => isGenericName(d.name));

  console.log('\n=== GENERIC/CRAPPY NAMES ===');
  console.log('(Likely slipped through - ' + genericDeals.length + ' found)\n');
  for (const d of genericDeals) {
    console.log('  - "' + d.name + '" (' + d.slug + ')');
  }

  // Combine and dedupe
  const rewriteSlugs = new Set<string>();

  for (const d of first37) {
    rewriteSlugs.add(d.slug);
  }

  for (const d of genericDeals) {
    rewriteSlugs.add(d.slug);
  }

  const rewriteArray = Array.from(rewriteSlugs).sort();

  console.log('\n=== COMBINED REWRITE LIST ===');
  console.log('Total unique slugs needing full rewrite: ' + rewriteArray.length);

  // Save to JSON
  await fs.mkdir('./data', { recursive: true });
  await fs.writeFile('./data/rewrite-needed-slugs.json', JSON.stringify(rewriteArray, null, 2));
  console.log('\n✅ Saved to ./data/rewrite-needed-slugs.json');

  // Also save detailed info
  const detailed = {
    first37: first37.map(d => ({ slug: d.slug, name: d.name, displayOrder: d.displayOrder })),
    genericNames: genericDeals.map(d => ({ slug: d.slug, name: d.name })),
    combinedSlugs: rewriteArray,
    totalCount: rewriteArray.length,
  };
  await fs.writeFile('./data/rewrite-needed-detailed.json', JSON.stringify(detailed, null, 2));
  console.log('✅ Saved detailed info to ./data/rewrite-needed-detailed.json');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
