#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface LedgerEntry {
  code: string;
  beforeCents: number;
  afterCents: number;
  currency: string;
  display?: string;
  [key: string]: any;
}

interface BestEntry {
  beforeCents: number;
  afterCents: number;
  currency: string;
  display?: string;
  [key: string]: any;
}

interface WhopData {
  ledger?: LedgerEntry[];
  best?: BestEntry;
  price?: string; // optional, some files have it
  [key: string]: any;
}

/** Extract two amounts from a display string.
 *  Supports $, £, €, ISO codes (USD/GBP/EUR), commas, decimals,
 *  optional text like (ex-VAT), and separators → | -> | - */
function parseDisplay(display?: string): { beforeCents: number; afterCents: number } | null {
  if (!display) return null;

  // Normalize arrows to "->"
  const norm = display.replace(/→/g, '->');

  // Grab the first two number-like tokens (handles "£5,000.00" or "EUR 1,234.56")
  const amountRegex = /(?:USD|GBP|EUR|\$|£|€)?\s*([\d.,]+)(?:\s*\(.*?\))?/gi;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(norm)) !== null) {
    const raw = m[1].trim();

    // Handle EU formatting like "1.234,56"
    let cleaned = raw;
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      // Decide which is thousands vs decimal by last occurrence:
      // If comma appears after dot, assume comma is decimal (EU style).
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
      } else {
        cleaned = cleaned.replace(/,/g, ''); // 1,234.56 -> 1234.56
      }
    } else if (hasComma && !hasDot) {
      // "1,234" -> 1234
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // keep as-is (e.g., "1234.56")
    }

    const val = Number.parseFloat(cleaned);
    if (!Number.isNaN(val)) nums.push(val);
    if (nums.length === 2) break;
  }

  if (nums.length < 2) return null;
  return {
    beforeCents: Math.round(nums[0] * 100),
    afterCents: Math.round(nums[1] * 100),
  };
}

function fixFromDisplay(entry: LedgerEntry | BestEntry, label: string): boolean {
  const parsed = 'display' in entry ? parseDisplay(entry.display) : null;
  if (!parsed) return false;

  let changed = false;
  if (entry.beforeCents !== parsed.beforeCents) {
    console.log(`  ${label}: beforeCents ${entry.beforeCents} → ${parsed.beforeCents} (from display)`);
    entry.beforeCents = parsed.beforeCents;
    changed = true;
  }
  if (entry.afterCents !== parsed.afterCents) {
    console.log(`  ${label}: afterCents ${entry.afterCents} → ${parsed.afterCents} (from display)`);
    entry.afterCents = parsed.afterCents;
    changed = true;
  }
  return changed;
}

/** Multiply by 100 when both values look off and the file contains at least one corrected "large" amount */
function fixByFileScale(entry: LedgerEntry | BestEntry, label: string, fileHasLargeAmount: boolean): boolean {
  let changed = false;
  const { beforeCents, afterCents } = entry as any;

  // Entry needs scaling if BOTH values look like dollars-not-cents
  // (both under $1,000) and at least one is suspiciously small (< $100).
  const needsScaling =
    beforeCents < 100_000 && afterCents < 100_000 &&   // both < $1,000
    (beforeCents < 10_000 || afterCents < 10_000);     // one < $100

  if (needsScaling) {
    const scaledBefore = beforeCents * 100;
    const scaledAfter  = afterCents  * 100;

    // Apply only if the result is sane: >= $15, and after <= before.
    if (scaledBefore >= 1_500 && scaledAfter >= 1_500 && scaledAfter <= scaledBefore) {
      console.log(`  ${label}: ×100 heuristic -> before ${beforeCents}→${scaledBefore}, after ${afterCents}→${scaledAfter}`);
      (entry as any).beforeCents = scaledBefore;
      (entry as any).afterCents  = scaledAfter;
      changed = true;
    }
  }
  return changed;
}

function processFile(filePath: string, writeMode: boolean): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  const data: WhopData = JSON.parse(content);
  const fileName = path.basename(filePath);

  let fileChanged = false;
  let anyLarge = false;

  console.log(`\nProcessing: ${fileName}`);

  // Pass 1: fix from display where possible (ledger + best)
  if (data.ledger && Array.isArray(data.ledger)) {
    data.ledger.forEach((entry, i) => {
      if (fixFromDisplay(entry, `ledger[${i}]`)) fileChanged = true;
    });
  }
  if (data.best) {
    if (fixFromDisplay(data.best, 'best')) fileChanged = true;
  }

  // Pass 2: Cross-reference fix - if best entry has wrong values but same code exists in ledger with correct values
  if (data.best && data.ledger) {
    const matchingLedgerEntry = data.ledger.find(entry => entry.code === data.best!.code);
    if (matchingLedgerEntry) {
      let changed = false;

      // Check if best beforeCents is wrong but ledger has the right value
      if (data.best.beforeCents !== matchingLedgerEntry.beforeCents) {
        console.log(`  best: beforeCents ${data.best.beforeCents} → ${matchingLedgerEntry.beforeCents} (from matching ledger entry)`);
        data.best.beforeCents = matchingLedgerEntry.beforeCents;
        changed = true;
      }

      // Check if best afterCents is wrong but ledger has the right value
      if (data.best.afterCents !== matchingLedgerEntry.afterCents) {
        console.log(`  best: afterCents ${data.best.afterCents} → ${matchingLedgerEntry.afterCents} (from matching ledger entry)`);
        data.best.afterCents = matchingLedgerEntry.afterCents;
        changed = true;
      }

      if (changed) fileChanged = true;
    }
  }

  // Determine if the file now contains any "large" value (>= $1,000) to anchor the scale heuristic
  const amounts: number[] = [];
  if (data.ledger) for (const e of data.ledger) { amounts.push(e.beforeCents, e.afterCents); }
  if (data.best) amounts.push(data.best.beforeCents, data.best.afterCents);
  anyLarge = amounts.some(v => v >= 100000);

  // Pass 3: for entries still small on both fields, scale by ×100 if the file has a large anchor
  if (data.ledger && anyLarge) {
    data.ledger.forEach((entry, i) => {
      if (fixByFileScale(entry, `ledger[${i}]`, anyLarge)) fileChanged = true;
    });
  }
  if (data.best && anyLarge) {
    if (fixByFileScale(data.best, 'best', anyLarge)) fileChanged = true;
  }

  if (fileChanged) {
    if (writeMode) {
      fs.writeFileSync(filePath + '.bak', content);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  ✅ Updated ${fileName} (backup: ${fileName}.bak)`);
    } else {
      console.log(`  📝 Would update ${fileName} (dry-run)`);
    }
    return true;
  } else {
    console.log(`  ✨ No changes needed for ${fileName}`);
    return false;
  }
}

function main() {
  const writeMode = process.argv.includes('--write');
  console.log(writeMode ? '🔧 WRITE MODE' : '👀 DRY RUN');
  console.log('=====================================');

  const dataDir = path.join(process.cwd(), 'data', 'pages');
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json') && !f.endsWith('.bak'))
    .map(f => path.join(dataDir, f));

  let total = 0, changed = 0;
  for (const f of files) {
    total++;
    if (processFile(f, writeMode)) changed++;
  }

  console.log('\n=====================================');
  console.log(`📊 Summary: ${changed}/${total} files ${writeMode ? 'updated' : 'would be updated'}`);
  if (!writeMode && changed > 0) console.log('💡 Re-run with --write to apply changes');
}

// ESM-compatible entry point check
if (import.meta.url === `file://${process.argv[1]}`) main();