/**
 * Extract current indexable slugs from the database
 * These are the pages Google could have seen (need full rewrite)
 */

import { prisma } from '../src/lib/prisma';
import { whereIndexable } from '../src/lib/where-indexable';
import fs from 'fs/promises';

async function main() {
  await prisma.$connect();

  console.log('📊 Extracting indexable slugs from database...\n');

  // Get all indexable pages (pages Google could have seen)
  const indexable = await prisma.deal.findMany({
    where: whereIndexable(),
    select: { slug: true, name: true, indexingStatus: true },
    orderBy: { slug: 'asc' }
  });

  // Get counts by status
  const allDeals = await prisma.deal.groupBy({
    by: ['indexingStatus'],
    _count: true,
  });

  console.log('=== DATABASE SUMMARY ===');
  console.log('Status breakdown:');
  for (const s of allDeals) {
    console.log('  ' + (s.indexingStatus || 'NULL') + ': ' + s._count);
  }

  console.log('\n=== INDEXABLE PAGES (need full rewrite) ===');
  console.log('Total: ' + indexable.length + ' pages');

  // Save to JSON
  const slugs = indexable.map(d => d.slug);
  await fs.writeFile('./data/indexable-slugs.json', JSON.stringify(slugs, null, 2));
  console.log('\n✅ Saved to ./data/indexable-slugs.json');

  // Show first 20
  console.log('\nFirst 20 indexable slugs:');
  for (const s of slugs.slice(0, 20)) {
    console.log('  - ' + s);
  }

  if (slugs.length > 20) {
    console.log('  ... and ' + (slugs.length - 20) + ' more');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
