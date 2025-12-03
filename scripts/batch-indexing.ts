/**
 * Safe Batch Indexing Script for Google Search Console
 *
 * Phase H: Safe Batch Upload Automation
 *
 * This script generates batched URL lists for staged submission to
 * Google Search Console's Indexing API or manual URL inspection.
 *
 * Features:
 * - Generates URLs in batches of configurable size (default: 200/day GSC limit)
 * - Tracks which URLs have been submitted
 * - Prioritizes high-quality content first
 * - Supports resumable batching across multiple days
 *
 * Usage:
 *   npx ts-node scripts/batch-indexing.ts --batch=1 --size=200
 *   npx ts-node scripts/batch-indexing.ts --generate-all
 *   npx ts-node scripts/batch-indexing.ts --status
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { whereIndexable } from '../src/lib/where-indexable';
import { SITE_URL } from '../src/lib/brand';

const OUTPUT_DIR = './data/indexing-batches';
const STATUS_FILE = './data/indexing-status.json';
const DEFAULT_BATCH_SIZE = 200; // Google's daily limit for Indexing API

interface IndexingStatus {
  lastBatch: number;
  totalBatches: number;
  submittedUrls: string[];
  generatedAt: string;
  siteUrl: string;
}

interface Deal {
  slug: string;
  name: string;
  updatedAt: Date;
  indexingStatus: string | null;
  promoCodesCount?: number;
}

async function loadStatus(): Promise<IndexingStatus | null> {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveStatus(status: IndexingStatus): Promise<void> {
  await fs.mkdir(path.dirname(STATUS_FILE), { recursive: true });
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

async function getIndexableDeals(): Promise<Deal[]> {
  const deals = await prisma.deal.findMany({
    where: whereIndexable(),
    select: {
      slug: true,
      name: true,
      updatedAt: true,
      indexingStatus: true,
      _count: {
        select: { promoCodes: true }
      }
    },
    orderBy: [
      // Prioritize deals with promo codes (higher quality)
      { updatedAt: 'desc' },
    ],
  });

  return deals.map(d => ({
    slug: d.slug,
    name: d.name,
    updatedAt: d.updatedAt,
    indexingStatus: d.indexingStatus,
    promoCodesCount: d._count.promoCodes,
  }));
}

function dealToUrl(slug: string): string {
  return `${SITE_URL}/offer/${slug}`;
}

async function generateBatch(batchNumber: number, batchSize: number): Promise<void> {
  console.log(`\n📦 Generating batch ${batchNumber} (size: ${batchSize})...`);

  const deals = await getIndexableDeals();
  const status = await loadStatus();

  // Filter out already submitted URLs
  const submittedSet = new Set(status?.submittedUrls || []);
  const remainingDeals = deals.filter(d => !submittedSet.has(dealToUrl(d.slug)));

  if (remainingDeals.length === 0) {
    console.log('✅ All URLs have been submitted!');
    return;
  }

  // Sort by quality (deals with promo codes first, then by recency)
  remainingDeals.sort((a, b) => {
    // Deals with promo codes first
    if ((b.promoCodesCount || 0) !== (a.promoCodesCount || 0)) {
      return (b.promoCodesCount || 0) - (a.promoCodesCount || 0);
    }
    // Then by most recently updated
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const start = (batchNumber - 1) * batchSize;
  const batchDeals = remainingDeals.slice(start, start + batchSize);

  if (batchDeals.length === 0) {
    console.log(`⚠️ Batch ${batchNumber} is empty - all remaining URLs submitted or batch number too high.`);
    return;
  }

  // Generate URLs for this batch
  const urls = batchDeals.map(d => dealToUrl(d.slug));

  // Write batch file
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const batchFile = path.join(OUTPUT_DIR, `batch-${batchNumber.toString().padStart(3, '0')}.txt`);
  await fs.writeFile(batchFile, urls.join('\n'));

  // Write detailed JSON for reference
  const detailFile = path.join(OUTPUT_DIR, `batch-${batchNumber.toString().padStart(3, '0')}-details.json`);
  await fs.writeFile(detailFile, JSON.stringify({
    batchNumber,
    generatedAt: new Date().toISOString(),
    urlCount: urls.length,
    deals: batchDeals.map(d => ({
      slug: d.slug,
      name: d.name,
      url: dealToUrl(d.slug),
      promoCodesCount: d.promoCodesCount,
      updatedAt: d.updatedAt,
    })),
  }, null, 2));

  console.log(`✅ Generated ${urls.length} URLs`);
  console.log(`📁 Batch file: ${batchFile}`);
  console.log(`📁 Details: ${detailFile}`);
  console.log(`\n📋 First 5 URLs in batch:`);
  urls.slice(0, 5).forEach(u => console.log(`   ${u}`));

  const totalBatches = Math.ceil(remainingDeals.length / batchSize);
  console.log(`\n📊 Progress: Batch ${batchNumber} of ~${totalBatches} total`);
  console.log(`   Remaining URLs: ${remainingDeals.length - batchDeals.length}`);
}

async function generateAllBatches(batchSize: number): Promise<void> {
  console.log(`\n🚀 Generating all batches (size: ${batchSize} per batch)...`);

  const deals = await getIndexableDeals();
  const totalBatches = Math.ceil(deals.length / batchSize);

  console.log(`📊 Total indexable deals: ${deals.length}`);
  console.log(`📦 Total batches to generate: ${totalBatches}`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Sort by quality
  deals.sort((a, b) => {
    if ((b.promoCodesCount || 0) !== (a.promoCodesCount || 0)) {
      return (b.promoCodesCount || 0) - (a.promoCodesCount || 0);
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Generate all batches
  for (let i = 0; i < totalBatches; i++) {
    const batchNumber = i + 1;
    const start = i * batchSize;
    const batchDeals = deals.slice(start, start + batchSize);
    const urls = batchDeals.map(d => dealToUrl(d.slug));

    const batchFile = path.join(OUTPUT_DIR, `batch-${batchNumber.toString().padStart(3, '0')}.txt`);
    await fs.writeFile(batchFile, urls.join('\n'));

    console.log(`✅ Batch ${batchNumber}: ${urls.length} URLs`);
  }

  // Update status
  await saveStatus({
    lastBatch: 0,
    totalBatches,
    submittedUrls: [],
    generatedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
  });

  console.log(`\n✅ Generated ${totalBatches} batch files in ${OUTPUT_DIR}`);
  console.log(`\n📋 Submission instructions:`);
  console.log(`   1. Submit one batch per day to respect GSC rate limits`);
  console.log(`   2. Use: npx ts-node scripts/batch-indexing.ts --mark-submitted=1`);
  console.log(`   3. Monitor GSC for indexing status`);
}

async function showStatus(): Promise<void> {
  console.log('\n📊 Indexing Status\n');

  const deals = await getIndexableDeals();
  const status = await loadStatus();

  console.log(`🌐 Site URL: ${SITE_URL}`);
  console.log(`📦 Total indexable deals: ${deals.length}`);

  if (status) {
    const submittedCount = status.submittedUrls.length;
    const remainingCount = deals.length - submittedCount;
    const batchesRemaining = Math.ceil(remainingCount / DEFAULT_BATCH_SIZE);

    console.log(`\n📈 Progress:`);
    console.log(`   Submitted: ${submittedCount} URLs`);
    console.log(`   Remaining: ${remainingCount} URLs`);
    console.log(`   Days to complete: ~${batchesRemaining} (at ${DEFAULT_BATCH_SIZE}/day)`);
    console.log(`   Last updated: ${status.generatedAt}`);
  } else {
    console.log(`\n⚠️ No indexing status found. Run --generate-all to start.`);
  }

  // Show quality breakdown
  const withPromoCodes = deals.filter(d => (d.promoCodesCount || 0) > 0).length;
  console.log(`\n📊 Quality breakdown:`);
  console.log(`   With promo codes: ${withPromoCodes} (${((withPromoCodes / deals.length) * 100).toFixed(1)}%)`);
  console.log(`   Without promo codes: ${deals.length - withPromoCodes}`);
}

async function markBatchSubmitted(batchNumber: number): Promise<void> {
  const batchFile = path.join(OUTPUT_DIR, `batch-${batchNumber.toString().padStart(3, '0')}.txt`);

  try {
    const urls = (await fs.readFile(batchFile, 'utf-8')).split('\n').filter(Boolean);
    const status = await loadStatus() || {
      lastBatch: 0,
      totalBatches: 0,
      submittedUrls: [],
      generatedAt: new Date().toISOString(),
      siteUrl: SITE_URL,
    };

    // Add URLs to submitted list
    const newSubmitted = [...new Set([...status.submittedUrls, ...urls])];

    await saveStatus({
      ...status,
      lastBatch: batchNumber,
      submittedUrls: newSubmitted,
    });

    console.log(`✅ Marked batch ${batchNumber} as submitted (${urls.length} URLs)`);
    console.log(`📊 Total submitted: ${newSubmitted.length}`);
  } catch (error) {
    console.error(`❌ Could not find batch file: ${batchFile}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Safe Batch Indexing Script for Google Search Console

Usage:
  npx ts-node scripts/batch-indexing.ts [options]

Options:
  --batch=N          Generate batch number N
  --size=N           Batch size (default: ${DEFAULT_BATCH_SIZE})
  --generate-all     Generate all batches at once
  --mark-submitted=N Mark batch N as submitted
  --status           Show current indexing status
  --help, -h         Show this help message

Examples:
  # Generate first batch
  npx ts-node scripts/batch-indexing.ts --batch=1

  # Generate all batches
  npx ts-node scripts/batch-indexing.ts --generate-all

  # After submitting batch 1 to GSC
  npx ts-node scripts/batch-indexing.ts --mark-submitted=1

  # Check progress
  npx ts-node scripts/batch-indexing.ts --status
`);
    return;
  }

  await prisma.$connect();

  try {
    const batchArg = args.find(a => a.startsWith('--batch='));
    const sizeArg = args.find(a => a.startsWith('--size='));
    const markArg = args.find(a => a.startsWith('--mark-submitted='));

    const batchSize = sizeArg ? parseInt(sizeArg.split('=')[1]) : DEFAULT_BATCH_SIZE;

    if (args.includes('--status')) {
      await showStatus();
    } else if (args.includes('--generate-all')) {
      await generateAllBatches(batchSize);
    } else if (markArg) {
      const batchNumber = parseInt(markArg.split('=')[1]);
      await markBatchSubmitted(batchNumber);
    } else if (batchArg) {
      const batchNumber = parseInt(batchArg.split('=')[1]);
      await generateBatch(batchNumber, batchSize);
    } else {
      // Default: show status
      await showStatus();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
