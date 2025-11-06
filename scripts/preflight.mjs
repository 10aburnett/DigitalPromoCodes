#!/usr/bin/env node
// scripts/preflight.mjs
//
// PRE-FLIGHT validation that BLOCKS unsafe runs.
// Computes exact set math, asserts identity, verifies batch eligibility.
// Exit codes: 0=pass, 1=args, 2=files missing, 3=identity fail, 4=batch invalid

import fs from 'fs';
import { execSync } from 'child_process';

// Parse args
const args = process.argv.slice(2);
let scope = 'promo';  // default
let limit = 150;      // default

for (const arg of args) {
  if (arg.startsWith('--scope=')) {
    scope = arg.replace('--scope=', '');
  } else if (arg.startsWith('--limit=')) {
    limit = Number(arg.replace('--limit=', ''));
  }
}

if (!['promo', 'all'].includes(scope)) {
  console.error('❌ Invalid scope. Use --scope=promo or --scope=all');
  process.exit(1);
}

if (isNaN(limit) || limit < 1) {
  console.error('❌ Invalid limit. Use --limit=<positive number>');
  process.exit(1);
}

// File paths
const PROMO_FILE = 'data/promo-whop-slugs.txt';
const MANUAL_FILE = 'data/manual/promo-manual-content.txt';
const CHECKPOINT = 'data/content/.checkpoint.json';
const NEEDS_FILE = '/tmp/needs-content.csv';
const BATCH_FILE = '/tmp/next-batch.csv';

// Helper: read lines from file
function readLines(path) {
  try {
    return fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Check required files exist
console.log('[PRE-FLIGHT]');

if (!fs.existsSync(NEEDS_FILE)) {
  console.error(`❌ Missing ${NEEDS_FILE} - run scripts/query-whops-needing-content.mjs first`);
  process.exit(2);
}

if (!fs.existsSync(CHECKPOINT)) {
  console.error(`❌ Missing ${CHECKPOINT}`);
  process.exit(2);
}

if (scope === 'promo' && !fs.existsSync(PROMO_FILE)) {
  console.error(`❌ Missing ${PROMO_FILE} - run scripts/query-promo-whops.mjs first`);
  process.exit(2);
}

if (!fs.existsSync(MANUAL_FILE)) {
  console.error(`❌ Missing ${MANUAL_FILE}`);
  process.exit(2);
}

// Load sets
const needs = new Set(readLines(NEEDS_FILE));
const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
const done = new Set(Object.keys(checkpoint.done || {}));
const rejected = new Set(Object.keys(checkpoint.rejected || {}));
const manual = new Set(readLines(MANUAL_FILE));

console.log(`Needs (from DB)      : ${needs.size}`);
console.log(`Done (checkpoint)    : ${done.size}`);
console.log(`Rejected (checkpoint): ${rejected.size}`);
console.log(`Manual (file)        : ${manual.size}`);

// Compute promo-specific sets if scope=promo
if (scope === 'promo') {
  const promo = new Set(readLines(PROMO_FILE));
  console.log(`\nP (promo in DB)      : ${promo.size}`);

  // Intersect with promo
  const M = new Set([...manual].filter(s => promo.has(s)));
  const D_raw = new Set([...done].filter(s => promo.has(s)));
  const R_raw = new Set([...rejected].filter(s => promo.has(s)));

  // Exclude manual from done/rejected to avoid double-counting
  const D = new Set([...D_raw].filter(s => !M.has(s)));
  const R = new Set([...R_raw].filter(s => !M.has(s)));

  // Unaccounted = promo - (done ∪ rejected ∪ manual)
  const accounted = new Set([...D, ...R, ...M]);
  const U = new Set([...promo].filter(s => !accounted.has(s)));

  console.log(`M (manual ∩ P)       : ${M.size}`);
  console.log(`D\\M (done ∩ P excl M): ${D.size}`);
  console.log(`R\\M (rej ∩ P excl M) : ${R.size}`);
  console.log(`U (unaccounted ∩ P)  : ${U.size}`);

  // Assert identity: |P| = |D\M| + |R\M| + |M| + |U|
  const sum = D.size + R.size + M.size + U.size;
  const balanced = (promo.size === sum);

  console.log(`\nIdentity: ${promo.size} = ${D.size} + ${R.size} + ${M.size} + ${U.size}`);

  if (!balanced) {
    console.error(`❌ IDENTITY FAILED: ${promo.size} ≠ ${sum}`);
    console.error(`  P (promo in DB):      ${promo.size}`);
    console.error(`  D\\M (done excl M):    ${D.size}`);
    console.error(`  R\\M (rejected excl M):${R.size}`);
    console.error(`  M (manual ∩ P):       ${M.size}`);
    console.error(`  U (unaccounted):      ${U.size}`);
    process.exit(3);
  }

  console.log('✅ Identity balanced');

  // If batch exists, verify it
  if (fs.existsSync(BATCH_FILE)) {
    const batchLines = readLines(BATCH_FILE);

    // Validate batch format (catch stale/malformed slugs)
    const invalidFormat = batchLines.filter(s => !s || s === "-" || /\s/.test(s));
    if (invalidFormat.length > 0) {
      console.error(`❌ BATCH INVALID: ${invalidFormat.length} malformed slugs (empty, "-", or contains spaces)`);
      console.error(`First 10: ${invalidFormat.slice(0, 10).map(s => `"${s}"`).join(', ')}`);
      process.exit(4);
    }

    const batch = new Set(batchLines);
    console.log(`\nNext batch size      : ${batch.size} (limit=${limit})`);

    // All batch items must be in unaccounted set
    const invalid = [...batch].filter(s => !U.has(s));
    if (invalid.length > 0) {
      console.error(`❌ BATCH INVALID: ${invalid.length} items not in unaccounted promo set`);
      console.error(`First 10 invalid: ${invalid.slice(0, 10).join(', ')}`);
      process.exit(4);
    }

    // Verify all batch items are actually promo (via DB check)
    console.log('🔒 Verifying batch items are promo (DB check)...');
    try {
      const batchCsv = [...batch].join(',');
      execSync(`node scripts/verify-promo-slugs.mjs "${batchCsv}"`, { stdio: 'inherit' });
      console.log('✅ All batch items verified as promo');
    } catch (err) {
      console.error('❌ BATCH VERIFICATION FAILED');
      process.exit(4);
    }
  } else {
    console.log(`\nNo batch file found at ${BATCH_FILE}`);
    console.log(`Expected queue size: ${U.size} promo items needing content`);
  }

} else {
  // scope=all
  console.log(`\nScope: all (non-promo)`);

  // Load denylist
  const DENY_FILE = "data/manual/denylist.txt";
  const deny = new Set(readLines(DENY_FILE));
  console.log(`Denied (denylist)    : ${deny.size}`);

  // Candidates = needs - (done ∪ rejected ∪ manual ∪ deny)
  const allDone = new Set([...done, ...rejected, ...manual, ...deny]);
  const candidates = new Set([...needs].filter(s => !allDone.has(s)));

  console.log(`Total candidates     : ${candidates.size}`);

  // If batch exists, verify it
  if (fs.existsSync(BATCH_FILE)) {
    const batchLines = readLines(BATCH_FILE);

    // Validate batch format (catch stale/malformed slugs)
    const invalidFormat = batchLines.filter(s => !s || s === "-" || /\s/.test(s));
    if (invalidFormat.length > 0) {
      console.error(`❌ BATCH INVALID: ${invalidFormat.length} malformed slugs (empty, "-", or contains spaces)`);
      console.error(`First 10: ${invalidFormat.slice(0, 10).map(s => `"${s}"`).join(', ')}`);
      process.exit(4);
    }

    const batch = new Set(batchLines);
    console.log(`Next batch size      : ${batch.size} (limit=${limit})`);

    // All batch items must be in candidates
    const invalid = [...batch].filter(s => !candidates.has(s));
    if (invalid.length > 0) {
      console.error(`❌ BATCH INVALID: ${invalid.length} items not in eligible candidates`);
      console.error(`First 10 invalid: ${invalid.slice(0, 10).join(', ')}`);
      process.exit(4);
    }

    // All batch items must be in needs
    const notNeeded = [...batch].filter(s => !needs.has(s));
    if (notNeeded.length > 0) {
      console.error(`❌ BATCH INVALID: ${notNeeded.length} items not in needs-content`);
      console.error(`First 10 not needed: ${notNeeded.slice(0, 10).join(', ')}`);
      process.exit(4);
    }

    // None should be in done/rejected/manual
    const alreadyProcessed = [...batch].filter(s => allDone.has(s));
    if (alreadyProcessed.length > 0) {
      console.error(`❌ BATCH INVALID: ${alreadyProcessed.length} items already done/rejected/manual`);
      console.error(`First 10 already processed: ${alreadyProcessed.slice(0, 10).join(', ')}`);
      process.exit(4);
    }

    console.log('✅ Batch validated (all items eligible)');
  } else {
    console.log(`\nNo batch file found at ${BATCH_FILE}`);
    console.log(`Expected queue size: ${candidates.size} items needing content`);
  }
}

console.log('\n✅ PRE-FLIGHT PASSED\n');
process.exit(0);
