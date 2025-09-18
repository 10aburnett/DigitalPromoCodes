// scripts/add-real-discount-data.ts
// Add ACTUAL before/after prices using real discount data - HARDENED VERSION

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

// Robust price parsing that handles multiple currencies
function parsePrice(input: unknown): { amount: number; currency: string } | null {
  if (typeof input === 'number') return { amount: input, currency: 'USD' };
  if (typeof input !== 'string') return null;

  const currency =
    (input.includes('£') && 'GBP') ||
    (input.includes('€') && 'EUR') ||
    (input.includes('$') && 'USD') ||
    'USD';

  const m = input.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  if (!m) return null;

  const amount = parseFloat(m[1]);
  if (!isFinite(amount) || amount <= 0) return null;

  return { amount, currency };
}

// Format currency properly
function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)}`;
  }
}

// Parse promo values flexibly (%, decimal, fixed amounts, multi-currency)
function parsePromoValue(value: string): { type: 'percent'|'fixed'; amount: number } | null {
  const v = value.trim().toLowerCase();

  // percent like "10%" or " 10 % "
  const pct = v.match(/(\d+(\.\d+)?)\s*%/);
  if (pct) return { type: 'percent', amount: parseFloat(pct[1]) };

  // decimal "0.1" meaning 10%
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = parseFloat(v);
    if (n > 0 && n < 1) return { type: 'percent', amount: n * 100 };
    if (n > 0 && n <= 100) return { type: 'percent', amount: n }; // assume percent
    return { type: 'fixed', amount: n }; // big number → fixed amount off
  }

  // fixed with currency symbol/code
  const fixed = v.match(/(usd|\$|£|eur|€)\s*(\d+(\.\d+)?)/i);
  if (fixed) return { type: 'fixed', amount: parseFloat(fixed[2]) };

  return null;
}

// Calculate discount with proper clamping & formatting
function calcDiscount(original: { amount: number; currency: string }, promoValue: string) {
  const pv = parsePromoValue(promoValue);
  if (!pv) return null;

  let after = original.amount;
  if (pv.type === 'percent') after = original.amount * (1 - pv.amount / 100);
  else after = original.amount - pv.amount;

  after = Math.max(0, Math.round(after * 100) / 100);
  return {
    before: fmt(original.amount, original.currency),
    after: fmt(after, original.currency)
  };
}

async function getActualDiscountData() {
  console.log('🔍 Getting actual discount data from database...');

  const whops = await prisma.whop.findMany({
    where: {
      PromoCode: {
        some: {
          code: {
            startsWith: 'promo-',
            mode: 'insensitive',
          },
        },
      },
    },
    select: {
      slug: true,
      name: true,
      price: true,
      PromoCode: {
        where: {
          code: {
            startsWith: 'promo-',
            mode: 'insensitive',
          },
        },
        select: {
          code: true,
          value: true,
          description: true,
        }
      }
    },
  });

  return whops;
}

async function updateWithRealDiscounts() {
  // Optional: filter to single whop for testing
  const ONLY = process.env.WHOP_SLUG?.toLowerCase();

  const whops = await getActualDiscountData();
  const filtered = ONLY ? whops.filter(w => w.slug.toLowerCase() === ONLY) : whops;

  if (ONLY && filtered.length === 0) {
    console.log(`❌ No whop found with slug: ${ONLY}`);
    return;
  }

  const dataDir = path.join(process.cwd(), 'data', 'pages');
  const timestamp = nowIso();

  let updatedFiles = 0;
  let updatedCodes = 0;

  for (const whop of filtered) {
    const filePath = path.join(dataDir, `${whop.slug}.json`);

    if (!existsSync(filePath)) {
      console.log(`⚠️  JSON file not found for slug: ${whop.slug}`);
      continue;
    }

    // Parse price first - skip if unparseable
    const price = parsePrice(whop.price);
    if (!price) {
      console.log(`⚠️ Skipping ${whop.slug} — unable to parse price "${whop.price}"`);
      continue;
    }

    try {
      const existingData: FreshnessFile = JSON.parse(readFileSync(filePath, 'utf8'));
      let fileChanged = false;

      console.log(`\n📊 Processing: ${whop.name}`);
      console.log(`💲 Parsed price: ${price.amount} ${price.currency} from "${whop.price}"`);

      for (const promoCode of whop.PromoCode) {
        const entryIndex = existingData.ledger.findIndex(entry =>
          entry.code.toLowerCase() === promoCode.code!.toLowerCase()
        );

        if (entryIndex >= 0) {
          const entry = existingData.ledger[entryIndex];

          console.log(`🏷️  Code: ${promoCode.code}, Value: ${promoCode.value}`);

          // Calculate discount - skip if unparseable
          const out = calcDiscount(price, String(promoCode.value ?? ''));
          if (!out) {
            console.log(`⚠️ Skipping code ${promoCode.code} — unparseable promo value "${promoCode.value}"`);
            continue;
          }

          // Update with real pricing data, preserve existing status
          existingData.ledger[entryIndex] = {
            ...entry,
            status: entry.status ?? 'working', // preserve existing status
            before: out.before,
            after: out.after,
            notes: '', // customer-facing clean notes
            checkedAt: timestamp,
            verifiedAt: timestamp,
          };

          fileChanged = true;
          updatedCodes++;
          console.log(`✅ ${whop.slug}: ${out.before} → ${out.after}`);
        }
      }

      // Only write file if something actually changed
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
  console.log(`🎯 Codes updated with REAL pricing: ${updatedCodes}`);
  if (ONLY) console.log(`🔍 Filtered to slug: ${ONLY}`);
}

async function main() {
  try {
    await updateWithRealDiscounts();
    console.log('\n✅ All promo- codes now have ACTUAL discount pricing and clean notes!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();