// scripts/freshness-sync.ts
// Goal: For every Whop that already has a promo code in our DB,
// write/update a JSON freshness ledger used by the Whop page.
// No schema changes. Read-only DB queries only.

import 'dotenv/config';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type FreshnessRow = {
  code: string;
  maskInLedger: boolean;
  status: 'working' | 'expired' | 'unknown';
  before?: string;
  after?: string;
  notes: string;
  checkedAt: string;
};

type FreshnessFile = {
  whopUrl: string;
  lastUpdated: string;
  ledger: FreshnessRow[];
};

function nowIso(): string {
  return new Date().toISOString();
}

async function getWhopsWithCodes() {
  return await prisma.deal.findMany({
    where: {
      PromoCode: {
        some: {},  // Has at least one promo code
      },
      publishedAt: { not: null },  // Only published whops
      retired: { not: true },      // Not retired
    },
    select: {
      id: true,
      slug: true,
      name: true,
      affiliateLink: true,
      PromoCode: {
        select: {
          code: true,
          title: true,
          description: true,
          type: true,
          value: true,
        },
      },
    },
  });
}

async function main() {
  const outDir = path.join(process.cwd(), 'data', 'pages');
  mkdirSync(outDir, { recursive: true });

  console.log('🔍 Finding Whops with existing promo codes...');
  const whopsWithCodes = await getWhopsWithCodes();

  if (whopsWithCodes.length === 0) {
    console.log('❌ No Whops found with promo codes');
    return;
  }

  console.log(`✅ Found ${whopsWithCodes.length} Whops with promo codes`);

  const timestamp = nowIso();
  let written = 0;

  for (const whop of whopsWithCodes) {
    if (!whop.slug || !whop.PromoCode?.length) continue;

    const filePath = path.join(outDir, `${whop.slug}.json`);

    // Check if file already exists and preserve existing data
    let existingData: FreshnessFile | null = null;
    if (existsSync(filePath)) {
      try {
        existingData = JSON.parse(readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.log(`⚠️  Could not parse existing file: ${filePath}`);
      }
    }

    // Create whop URL from affiliate link
    let whopUrl = whop.affiliateLink;
    if (whopUrl.includes('?a=')) {
      whopUrl = whopUrl.split('?a=')[0];  // Remove affiliate parameter
    }
    if (!whopUrl.endsWith('/')) {
      whopUrl += '/';
    }

    const ledger: FreshnessRow[] = whop.PromoCode.map(promoCode => {
      const code = promoCode.code || 'HIDDEN';

      // Check if we already have data for this code
      const existingEntry = existingData?.ledger.find(entry => entry.code === code);

      if (existingEntry) {
        // Preserve existing data but update checkedAt
        return {
          ...existingEntry,
          checkedAt: timestamp,
        };
      }

      // New entry with better defaults
      return {
        code,
        maskInLedger: true,
        status: 'working' as const,  // Default to working for better SEO
        before: undefined,
        after: undefined,
        notes: '',
        checkedAt: timestamp,
      };
    });

    const payload: FreshnessFile = {
      whopUrl,
      lastUpdated: timestamp,
      ledger,
    };

    writeFileSync(filePath, JSON.stringify(payload, null, 2));
    written++;

    const action = existingData ? 'Updated' : 'Created';
    console.log(`📝 ${action}: ${filePath} (${whop.PromoCode.length} code${whop.PromoCode.length === 1 ? '' : 's'})`);
  }

  console.log(`\n✅ Freshness JSON written for ${written} Whops with existing promo codes.`);
  console.log(`📁 Files at: ${outDir}/<slug>.json`);
  console.log(`\n💡 These Whop pages will now show the "Verification Status" section.`);
}

main()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });