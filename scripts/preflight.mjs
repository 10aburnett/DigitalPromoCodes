#!/usr/bin/env node
// scripts/preflight.mjs
import fs from 'fs';
import {
  loadState,
  isValidSlug,
  writeFileAtomic,
  PROMO_FILE,
  NEEDS_FILE
} from "./lib/sets.mjs";

// ---------- args ----------
const args = process.argv.slice(2);
let scope = 'promo';
let limit = 150;
for (const a of args) {
  if (a.startsWith('--scope=')) scope = a.split('=')[1];
  else if (a.startsWith('--limit=')) limit = Number(a.split('=')[1]);
}
if (!['promo','all'].includes(scope)) {
  console.error('❌ Invalid --scope. Use promo|all'); process.exit(1);
}
if (!Number.isFinite(limit) || limit < 1) {
  console.error('❌ Invalid --limit. Use a positive integer'); process.exit(1);
}

// ---------- helpers ----------
function readLines(p) {
  try {
    return fs.readFileSync(p, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  } catch { return []; }
}
function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }

// ---------- freshness guard ----------
// Check if promo file exists
if (!fs.existsSync(PROMO_FILE)) {
  console.error(`❌ PROMO FILE MISSING: ${PROMO_FILE} does not exist. Run query-promo-whops.mjs first.`);
  process.exit(2);
}

// Check if promo file is stale relative to needs snapshot
const promoFresh = mtime(PROMO_FILE);
const needsFresh = mtime(NEEDS_FILE);
if (promoFresh < needsFresh) {
  console.error(`❌ PROMO LIST STALE: ${PROMO_FILE} is older than ${NEEDS_FILE}. Regenerate promo slugs first.`);
  process.exit(2);
}

// ---------- unified state ----------
const { needs, promo, manual, deny, done, rejected } = loadState();

console.log(`[PRE-FLIGHT]`);
console.log(`Scope                 : ${scope}`);
console.log(`Needs (from DB)       : ${needs.size}`);
console.log(`Done (checkpoint)     : ${done.size}`);
console.log(`Rejected (checkpoint) : ${rejected.size}`);
console.log(`Manual (file)         : ${manual.size}`);
console.log(`Denylist (file)       : ${deny.size}`);

// ---------- scope: promo ----------
let U; // for summary
if (scope === 'promo') {
  console.log(`\nScope: promo`);
  console.log(`Promo (from file)     : ${promo.size}`);

  // sets intersected with promo
  const M = new Set([...manual].filter(s => promo.has(s)));
  const D_raw = new Set([...done].filter(s => promo.has(s)));
  const R_raw = new Set([...rejected].filter(s => promo.has(s)));
  const DenyP = new Set([...deny].filter(s => promo.has(s)));

  // exclude manual from D and R to avoid double counting
  const D = new Set([...D_raw].filter(s => !M.has(s)));
  const R = new Set([...R_raw].filter(s => !M.has(s) && !D.has(s))); // belt-and-braces: exclude D from R

  // unaccounted = promo − (D ∪ R ∪ M ∪ DenyP)
  const accounted = new Set([...D, ...R, ...M, ...DenyP]);
  U = new Set([...promo].filter(s => !accounted.has(s)));

  console.log(`M (manual ∩ P)        : ${M.size}`);
  console.log(`D\\M (done excl M)      : ${D.size}`);
  console.log(`R\\M (rejected excl M)  : ${R.size}`);
  console.log(`DENY (∩ P)            : ${DenyP.size}`);
  console.log(`U (unaccounted ∩ P)   : ${U.size}`);

  const sum = D.size + R.size + M.size + DenyP.size + U.size;
  const balanced = (promo.size === sum);
  console.log(`\nIdentity: ${promo.size} = ${D.size} + ${R.size} + ${M.size} + ${DenyP.size} + ${U.size}`);

  if (!balanced) {
    console.error(`❌ IDENTITY FAILED: ${promo.size} ≠ ${sum}`);
    process.exit(3);
  }

  // Validate existing batch if present (must be subset of U and hygienic)
  const BATCH_FILE = '/tmp/next-batch.txt';
  if (fs.existsSync(BATCH_FILE)) {
    const batchLines = readLines(BATCH_FILE);
    const invalidFormat = batchLines.filter(s => !isValidSlug(s));
    if (invalidFormat.length > 0) {
      console.error(`❌ BATCH INVALID: ${invalidFormat.length} malformed slugs`);
      console.error(`First 10: ${invalidFormat.slice(0,10).map(s=>`"${s}"`).join(', ')}`);
      process.exit(4);
    }
    const batch = new Set(batchLines);
    console.log(`\nNext batch size       : ${batch.size} (limit=${limit})`);

    const notEligible = [...batch].filter(s => !U.has(s));
    if (notEligible.length > 0) {
      const reasons = notEligible.slice(0,10).map(s => {
        const inPromo = promo.has(s);
        const reason = !inPromo ? "not-in-promo"
          : done.has(s) ? "already-done"
          : rejected.has(s) ? "rejected"
          : manual.has(s) ? "manual"
          : deny.has(s) ? "denylist"
          : !isValidSlug(s) ? "invalid-slug"
          : "unknown";
        return `${s} → ${reason}`;
      });
      console.error(`❌ BATCH INVALID: ${notEligible.length} items not in unaccounted promo set`);
      console.error(`First 10 with reasons:\n  ${reasons.join('\n  ')}`);
      process.exit(4);
    }
  }
}

// ---------- scope: all (non-promo) ----------
if (scope === 'all') {
  console.log(`\nScope: all (non-promo)`);
  console.log(`Promo (to exclude)    : ${promo.size}`);

  // Candidates = (needs - promo) - (done ∪ rejected ∪ manual ∪ deny), with hygiene
  const excluded = new Set([...done, ...rejected, ...manual, ...deny]);
  const candidates = new Set(
    [...needs]
      .filter(isValidSlug)
      .filter(s => !promo.has(s))
      .filter(s => !excluded.has(s))
  );

  console.log(`Total candidates       : ${candidates.size}`);

  const BATCH_FILE = '/tmp/next-batch.txt';
  if (fs.existsSync(BATCH_FILE)) {
    const batchLines = readLines(BATCH_FILE).map(s => s.trim()).filter(Boolean);
    const invalidFormat = batchLines.filter(s => !isValidSlug(s));
    if (invalidFormat.length > 0) {
      console.error(`❌ BATCH INVALID: ${invalidFormat.length} malformed slugs`);
      console.error(`First 10: ${invalidFormat.slice(0,10).map(s=>`"${s}"`).join(', ')}`);
      process.exit(4);
    }
    const batch = new Set(batchLines);
    console.log(`Next batch size        : ${batch.size} (limit=${limit})`);

    const notEligible = [...batch].filter(s => !candidates.has(s));
    if (notEligible.length > 0) {
      const reasons = notEligible.slice(0,10).map(s => {
        const inNeeds = needs.has(s);
        const reason = !inNeeds ? "not-in-needs"
          : promo.has(s) ? "promo-item"
          : done.has(s) ? "already-done"
          : rejected.has(s) ? "rejected"
          : manual.has(s) ? "manual"
          : deny.has(s) ? "denylist"
          : !isValidSlug(s) ? "invalid-slug"
          : "unknown";
        return `${s} → ${reason}`;
      });
      console.error(`❌ BATCH INVALID: ${notEligible.length} items not in eligible candidates`);
      console.error(`First 10 with reasons:\n  ${reasons.join('\n  ')}`);
      process.exit(4);
    }
  }

  // expose for summary
  U = candidates;
}

// ---------- summary for progress log ----------
let unaccounted = 0;
if (scope === 'promo' && U) unaccounted = U.size;
if (scope === 'all' && U)   unaccounted = U.size;

const summary = {
  scope,
  needs: needs.size,
  done: done.size,
  rejected: rejected.size,
  manual: manual.size,
  promo: promo.size,
  unaccounted,
  ts: new Date().toISOString()
};
// Atomic write to prevent half-written summary JSON
try { writeFileAtomic("/tmp/preflight-summary.json", JSON.stringify(summary)); } catch {}

// done
console.log('\n✅ PRE-FLIGHT PASSED\n');
process.exit(0);
