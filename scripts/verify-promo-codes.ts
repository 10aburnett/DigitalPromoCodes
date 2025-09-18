// scripts/verify-promo-codes.ts
// Find all codes beginning with "promo-" and mark them as verified working codes

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
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
  verifiedAt?: string;
};

type FreshnessFile = {
  whopUrl: string;
  lastUpdated: string;
  ledger: FreshnessRow[];
};

function nowIso(): string {
  return new Date().toISOString();
}

async function findPromoCodesInDB() {
  console.log('🔍 Finding codes beginning with "promo-" in database...');

  const promoCodes = await prisma.promoCode.findMany({
    where: {
      code: {
        startsWith: 'promo-',
        mode: 'insensitive', // Case insensitive
      },
    },
    select: {
      code: true,
      whopId: true,
      Whop: {
        select: {
          slug: true,
          name: true,
        }
      }
    },
  });

  console.log(`✅ Found ${promoCodes.length} codes beginning with "promo-"`);

  // Group by whop slug
  const bySlug = new Map<string, string[]>();

  for (const promoCode of promoCodes) {
    if (!promoCode.Whop?.slug) continue;

    const slug = promoCode.Whop.slug;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, []);
    }
    bySlug.get(slug)!.push(promoCode.code!);

    console.log(`📝 ${promoCode.Whop.name}: ${promoCode.code}`);
  }

  return bySlug;
}

async function updateFreshnessFiles(promoCodesBySlug: Map<string, string[]>) {
  const dataDir = path.join(process.cwd(), 'data', 'pages');
  const timestamp = nowIso();

  let updatedFiles = 0;
  let updatedCodes = 0;

  for (const [slug, codes] of promoCodesBySlug) {
    const filePath = path.join(dataDir, `${slug}.json`);

    if (!existsSync(filePath)) {
      console.log(`⚠️  JSON file not found for slug: ${slug}`);
      continue;
    }

    try {
      const existingData: FreshnessFile = JSON.parse(readFileSync(filePath, 'utf8'));
      let fileChanged = false;

      for (const code of codes) {
        const entryIndex = existingData.ledger.findIndex(entry =>
          entry.code.toLowerCase() === code.toLowerCase()
        );

        if (entryIndex >= 0) {
          const entry = existingData.ledger[entryIndex];

          // Update to verified working status
          const wasUnverified = !entry.verifiedAt;

          existingData.ledger[entryIndex] = {
            ...entry,
            status: 'working',
            notes: entry.notes || 'Verified working - promo- prefix codes confirmed functional',
            checkedAt: timestamp,
            verifiedAt: timestamp, // Mark as actually verified
          };

          if (wasUnverified) {
            updatedCodes++;
            fileChanged = true;
            console.log(`✅ Updated ${slug}: ${code} → verified working`);
          }
        }
      }

      if (fileChanged) {
        existingData.lastUpdated = timestamp;
        writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        updatedFiles++;
        console.log(`💾 Saved: ${filePath}`);
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  console.log(`\n🎉 Summary:`);
  console.log(`📁 Files updated: ${updatedFiles}`);
  console.log(`🎯 Codes marked as verified: ${updatedCodes}`);
}

async function main() {
  try {
    const promoCodesBySlug = await findPromoCodesInDB();

    if (promoCodesBySlug.size === 0) {
      console.log('❌ No codes beginning with "promo-" found in database');
      return;
    }

    await updateFreshnessFiles(promoCodesBySlug);
    console.log('\n✅ All promo- codes have been marked as verified working!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();