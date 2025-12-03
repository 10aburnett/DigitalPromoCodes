// scripts/add-real-discount-data.ts
// COMPREHENSIVE: All promo codes with numeric data, ex-VAT labels, and best summaries

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type FreshnessRow = {
  code: string;
  maskInLedger: boolean;
  status: 'working' | 'expired' | 'unknown';
  beforeCents: number;
  afterCents: number;
  currency: string;
  display: string; // Formatted display with ex-VAT
  notes: string;
  checkedAt: string;
  verifiedAt?: string;
};

type BestDiscount = {
  code: string;
  beforeCents: number;
  afterCents: number;
  currency: string;
  computedAt: string;
};

type FreshnessFile = {
  whopUrl: string;
  lastUpdated: string;
  best?: BestDiscount;
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

// Parse promo values flexibly (%, decimal, fixed amounts, multi-currency, patterns)
function parsePromoValue(value: string): { type: 'percent'|'fixed'; amount: number } | null {
  const v = value.trim().toLowerCase();

  // Handle common patterns first
  if (/(half|50)\s*off/i.test(v)) return { type: 'percent', amount: 50 };
  if (/quarter\s*off|25\s*off/i.test(v)) return { type: 'percent', amount: 25 };
  if (/free\s*(month|trial)?/i.test(v)) return { type: 'percent', amount: 100 }; // 100% off first period
  if (/(student|academic)\s*discount/i.test(v)) return { type: 'percent', amount: 50 }; // Common student discounts
  if (/(welcome|new\s*customer)\s*(10|15|20)/i.test(v)) {
    const match = v.match(/(10|15|20)/);
    return { type: 'percent', amount: match ? parseInt(match[1]) : 15 };
  }

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
  console.log('🔍 Getting ALL whops with promo codes from database...');

  // Use correct relation name: PromoCode (not promoCodes)
  const whops = await prisma.deal.findMany({
    where: {
      PromoCode: {
        some: {}, // ANY promo code (not just promo- prefix)
      },
      publishedAt: { not: null },
      retired: { not: true },
    },
    include: {
      PromoCode: {
        select: {
          id: true,
          code: true,
          value: true,
          type: true,
          title: true,
          description: true,
        },
      },
    },
  });

  return whops;
}

async function updateWithRealDiscounts() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const ONLY = process.env.WHOP_SLUG?.toLowerCase();

  const whops = await getActualDiscountData();
  const filtered = ONLY ? whops.filter(w => w.slug.toLowerCase() === ONLY) : whops;

  if (ONLY && filtered.length === 0) {
    console.log(`❌ No whop found with slug: ${ONLY}`);
    return;
  }

  console.log(`✅ Found ${filtered.length} whops with promo codes to process`);

  const dataDir = path.join(process.cwd(), 'data', 'pages');
  const timestamp = nowIso();

  let updatedFiles = 0;
  let updatedCodes = 0;
  let newCodes = 0;

  for (const whop of filtered) {
    const filePath = path.join(dataDir, `${whop.slug}.json`);

    // Parse price first - skip if unparseable
    const price = parsePrice(whop.price);
    if (!price) {
      console.log(`⚠️ Skipping ${whop.slug} — unable to parse price "${whop.price}"`);
      continue;
    }

    try {
      // Load or create freshness file
      let existingData: FreshnessFile;
      if (existsSync(filePath)) {
        existingData = JSON.parse(readFileSync(filePath, 'utf8'));
      } else {
        // Create new freshness file
        let whopUrl = whop.affiliateLink;
        if (whopUrl && whopUrl.includes('?a=')) {
          whopUrl = whopUrl.split('?a=')[0];
        }
        if (whopUrl && !whopUrl.endsWith('/')) {
          whopUrl += '/';
        }

        existingData = {
          whopUrl: whopUrl || `https://whop.com/${whop.slug}/`,
          lastUpdated: timestamp,
          ledger: [],
        };
      }

      let fileChanged = false;

      console.log(`\n📊 Processing: ${whop.name}`);
      console.log(`💲 Parsed price: ${price.amount} ${price.currency} from "${whop.price}"`);
      console.log(`🏷️  Found ${whop.PromoCode.length} promo codes`);

      // Calculate discounts for ALL codes
      type DiscountResult = {
        code: string;
        beforeCents: number;
        afterCents: number;
        currency: string;
        display: string;
        parseable: boolean;
        appliesTo: string;
      };

      const discountResults: DiscountResult[] = [];

      for (const promoCode of whop.PromoCode) {
        console.log(`🏷️  Code: ${promoCode.code}, Value: ${promoCode.value}`);

        const out = calcDiscount(price, String(promoCode.value ?? ''));

        if (out) {
          // Parseable code
          discountResults.push({
            code: promoCode.code || '',
            beforeCents: price.amount,
            afterCents: Math.round(parseFloat(out.after.replace(/[^\d.-]/g, '')) * 100),
            currency: price.currency,
            display: `${out.before} → ${out.after}`,
            parseable: true,
            appliesTo: /free\s*(month|trial)?/i.test(promoCode.value) ? 'first_period' : 'unknown',
          });
        } else {
          // Unparseable code - keep in ledger but exclude from best
          discountResults.push({
            code: promoCode.code || '',
            beforeCents: price.amount,
            afterCents: price.amount,
            currency: price.currency,
            display: 'Unpriced code',
            parseable: false,
            appliesTo: 'unknown',
          });
        }
      }

      // Find best discount (lowest after price among parseable codes)
      const parseableResults = discountResults.filter(r => r.parseable);
      const bestResult = parseableResults.length > 0
        ? parseableResults.reduce((best, current) =>
            current.afterCents < best.afterCents ? current : best
          )
        : null;

      // Process each code: update existing OR insert new
      for (const result of discountResults) {
        const entryIndex = existingData.ledger.findIndex(entry =>
          entry.code.toLowerCase() === result.code.toLowerCase()
        );

        console.log(`🏷️  ${result.code}: ${result.display} (${result.parseable ? 'parseable' : 'unparseable'})`);

        if (entryIndex >= 0) {
          // Update existing entry
          const entry = existingData.ledger[entryIndex];

          // Update if values changed OR if notes need updating (for excluding VAT)
          const expectedNotes = result.appliesTo !== 'unknown'
            ? `Applies to ${result.appliesTo.replace('_', ' ')} • excluding VAT`
            : 'excluding VAT';

          if (entry.beforeCents !== result.beforeCents ||
              entry.afterCents !== result.afterCents ||
              entry.notes !== expectedNotes) {
            existingData.ledger[entryIndex] = {
              ...entry,
              status: entry.status || 'unknown', // Preserve existing status, default to unknown
              beforeCents: result.beforeCents,
              afterCents: result.afterCents,
              currency: result.currency,
              display: result.display,
              notes: result.appliesTo !== 'unknown'
                ? `Applies to ${result.appliesTo.replace('_', ' ')} • excluding VAT`
                : 'excluding VAT',
              checkedAt: timestamp,
              // Preserve verifiedAt if it exists
            };
            fileChanged = true;
            updatedCodes++;
            console.log(`✅ Updated: ${result.code}`);
          }
        } else {
          // Insert new entry for codes not in ledger
          existingData.ledger.push({
            code: result.code,
            maskInLedger: false, // Default to NOT masked - user can manually mask sensitive codes
            status: 'unknown', // New codes are unknown status until manually verified
            beforeCents: result.beforeCents,
            afterCents: result.afterCents,
            currency: result.currency,
            display: result.display,
            notes: result.appliesTo !== 'unknown'
              ? `Applies to ${result.appliesTo.replace('_', ' ')} • excluding VAT`
              : (result.parseable ? 'excluding VAT' : 'Unpriced code • excluding VAT'),
            checkedAt: timestamp,
          });
          fileChanged = true;
          newCodes++;
          console.log(`➕ Added: ${result.code}`);
        }
      }

      // Remove stale entries (codes in ledger but not in DB)
      const dbCodes = new Set(whop.PromoCode.map(c => c.code?.toLowerCase()).filter(Boolean));
      const initialLedgerSize = existingData.ledger.length;
      existingData.ledger = existingData.ledger.filter(entry =>
        dbCodes.has(entry.code.toLowerCase())
      );
      if (existingData.ledger.length < initialLedgerSize) {
        fileChanged = true;
        console.log(`🗑️  Removed ${initialLedgerSize - existingData.ledger.length} stale entries`);
      }

      // Add best summary block for fast above-the-fold rendering
      if (bestResult && fileChanged) {
        (existingData as any).best = {
          code: bestResult.code,
          beforeCents: bestResult.beforeCents,
          afterCents: bestResult.afterCents,
          currency: bestResult.currency,
          computedAt: timestamp,
        };
        console.log(`🏆 Best discount: ${bestResult.code} (${bestResult.beforeCents} → ${bestResult.afterCents} ${bestResult.currency})`);
      }

      // Atomic write with temp file
      if (fileChanged && !DRY_RUN) {
        existingData.lastUpdated = timestamp;
        const tempPath = `${filePath}.tmp`;
        writeFileSync(tempPath, JSON.stringify(existingData, null, 2));
        renameSync(tempPath, filePath);
        updatedFiles++;
        console.log(`💾 Saved: ${filePath}`);

        // Trigger page revalidation
        if (process.env.REVALIDATE_URL && process.env.REVALIDATE_TOKEN) {
          try {
            await fetch(process.env.REVALIDATE_URL, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.REVALIDATE_TOKEN}` },
              body: JSON.stringify({ slug: whop.slug, type: 'whop' })
            });
            console.log(`🔄 Revalidated page for ${whop.slug}`);
          } catch (e) {
            console.log(`⚠️  Revalidation failed for ${whop.slug}`);
          }
        }

      } else if (DRY_RUN && fileChanged) {
        console.log(`[DRY] Would update ${whop.slug} with ${whop.PromoCode.length} codes`);
        if (bestResult) {
          console.log(`[DRY] Best discount: ${bestResult.code} (${bestResult.beforeCents} → ${bestResult.afterCents} ${bestResult.currency})`);
        }
      } else if (!fileChanged) {
        console.log(`→ No changes needed for ${whop.slug}`);
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  console.log(`\n🎉 Summary:`);
  console.log(`📁 Files ${DRY_RUN ? 'would be updated' : 'updated'}: ${updatedFiles}`);
  console.log(`🔄 Existing codes ${DRY_RUN ? 'would be updated' : 'updated'}: ${updatedCodes}`);
  console.log(`➕ New codes ${DRY_RUN ? 'would be added' : 'added'}: ${newCodes}`);
  if (ONLY) console.log(`🔍 Filtered to slug: ${ONLY}`);
  if (DRY_RUN) console.log(`🧪 DRY RUN - No files were modified`);
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