#!/usr/bin/env node
// Check which of the missing promo items already have WhopContent in the database

import fs from 'fs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const slugs = fs.readFileSync('/tmp/promo-missing.txt', 'utf8')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

const existing = await prisma.whopContent.findMany({
  where: { whopSlug: { in: slugs } },
  select: { whopSlug: true }
});

const existingSlugs = new Set(existing.map(r => r.whopSlug));
const withContent = slugs.filter(s => existingSlugs.has(s));
const needsContent = slugs.filter(s => !existingSlugs.has(s));

console.log('=== ANALYSIS OF 32 MISSING PROMO ITEMS ===');
console.log(`Already have WhopContent: ${withContent.length}`);
console.log(`Actually need content: ${needsContent.length}`);
console.log('');

if (withContent.length > 0) {
  console.log('✅ Already have content (manually written?):');
  withContent.forEach(s => console.log('  - ' + s));
  console.log('');
}

if (needsContent.length > 0) {
  console.log('❌ Actually need AI generation:');
  needsContent.forEach(s => console.log('  - ' + s));

  // Write to file for easy processing
  fs.writeFileSync('/tmp/promo-truly-missing.txt', needsContent.join('\n'));
  console.log('\n📝 Written to /tmp/promo-truly-missing.txt');
}

await prisma.$disconnect();
