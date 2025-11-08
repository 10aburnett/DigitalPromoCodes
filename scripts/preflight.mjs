#!/usr/bin/env node
// scripts/preflight.mjs
// NOW WITH: Filter & rewrite batch instead of hard-fail (saves API budget)
import fs from 'fs';
import {
  loadState,
  loadCheckpoint,
  isValidSlug,
  writeFileAtomic,
  PROMO_FILE,
  NEEDS_FILE
} from "./lib/sets.mjs";
import { atomicWriteText } from "./lib/atomic.mjs";

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
const { needs, promo, manual, deny, done, rejected, queued } = loadState();

console.log(`[PRE-FLIGHT]`);
console.log(`Scope                 : ${scope}`);
console.log(`Needs (from DB)       : ${needs.size}`);
console.log(`Done (checkpoint)     : ${done.size}`);
console.log(`Rejected (checkpoint) : ${rejected.size}`);
console.log(`Queued (checkpoint)   : ${queued.size}`);
console.log(`Manual (file)         : ${manual.size}`);
console.log(`Denylist (file)       : ${deny.size}`);

// ---------- BATCH FILTERING (NEW: warn + rewrite instead of hard-fail) ----------
const BATCH_FILE = '/tmp/next-batch.txt';
const batchLines = readLines(BATCH_FILE);

if (batchLines.length === 0) {
  console.log("✅ Preflight: batch file empty; nothing to validate.");
  process.exit(0);
}

// Load checkpoint for queued-stamping verification
const ck = loadCheckpoint();
const queuedSet = new Set(Object.keys(ck.queued || {}));
const doneSet   = new Set(Object.keys(ck.done   || {}));
const rejSet    = new Set(Object.keys(ck.rejected || {}));

const valid = [];
const dropped = [];

for (const slug of batchLines) {
  if (!isValidSlug(slug)) {
    dropped.push({ slug, reason: "invalid-slug" });
    continue;
  }
  if (rejSet.has(slug)) {
    dropped.push({ slug, reason: "rejected" });
    continue;
  }
  if (doneSet.has(slug)) {
    dropped.push({ slug, reason: "already-done" });
    continue;
  }
  // Prefer the "queued-stamping" as the allowlist
  if (!queuedSet.has(slug)) {
    dropped.push({ slug, reason: "not-queued-in-checkpoint" });
    continue;
  }
  valid.push(slug);
}

if (dropped.length) {
  console.warn(`⚠️  Preflight: filtered ${dropped.length} item(s). First few:`);
  console.warn(dropped.slice(0, 10).map(d => `  ${d.slug} → ${d.reason}`).join('\n'));
  // Rewrite batch to ONLY the valid set (atomic)
  await atomicWriteText(BATCH_FILE, valid.join("\n"));
  console.log(`📝 Rewrote ${BATCH_FILE} with ${valid.length} valid items`);
}

if (valid.length === 0) {
  console.error("❌ Preflight: all items were filtered; nothing left to run.");
  console.error("   This likely means the batch was stale. Run build-next-batch again.");
  process.exit(3); // non-fatal signal for the runner to rebuild
}

console.log(`\n✅ Preflight: ${valid.length} item(s) remain after filtering.`);

// ---------- scope validation (original identity checks for telemetry) ----------
let U; // for summary
if (scope === 'promo') {
  console.log(`\nScope: promo`);
  console.log(`Promo (from file)     : ${promo.size}`);

  // sets intersected with promo
  const M = new Set([...manual].filter(s => promo.has(s)));
  const D_raw = new Set([...done].filter(s => promo.has(s)));
  const R_raw = new Set([...rejected].filter(s => promo.has(s)));
  const DenyP = new Set([...deny].filter(s => promo.has(s)));
  const Q = new Set([...queued].filter(s => promo.has(s)));

  // exclude manual from D and R to avoid double counting
  const D = new Set([...D_raw].filter(s => !M.has(s)));
  const R = new Set([...R_raw].filter(s => !M.has(s) && !D.has(s)));

  // unaccounted = promo − (D ∪ R ∪ Q ∪ M ∪ DenyP)
  const accounted = new Set([...D, ...R, ...Q, ...M, ...DenyP]);
  U = new Set([...promo].filter(s => !accounted.has(s)));

  console.log(`M (manual ∩ P)        : ${M.size}`);
  console.log(`D\\M (done excl M)      : ${D.size}`);
  console.log(`R\\M (rejected excl M)  : ${R.size}`);
  console.log(`Q (queued ∩ P)        : ${Q.size}`);
  console.log(`DENY (∩ P)            : ${DenyP.size}`);
  console.log(`U (unaccounted ∩ P)   : ${U.size}`);

  const sum = D.size + R.size + Q.size + M.size + DenyP.size + U.size;
  const balanced = (promo.size === sum);
  console.log(`\nIdentity: ${promo.size} = ${D.size} + ${R.size} + ${Q.size} + ${M.size} + ${DenyP.size} + ${U.size}`);

  if (!balanced) {
    console.warn(`⚠️  IDENTITY DRIFT: ${promo.size} ≠ ${sum} (non-fatal)`);
  }
}

// ---------- scope: all (non-promo) ----------
if (scope === 'all') {
  console.log(`\nScope: all (non-promo)`);
  console.log(`Promo (to exclude)    : ${promo.size}`);

  // Candidates = (needs - promo) - (done ∪ rejected ∪ queued ∪ manual ∪ deny), with hygiene
  const excluded = new Set([...done, ...rejected, ...queued, ...manual, ...deny]);
  const candidates = new Set(
    [...needs]
      .filter(isValidSlug)
      .filter(s => !promo.has(s))
      .filter(s => !excluded.has(s))
  );

  console.log(`Total candidates       : ${candidates.size}`);

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
  queued: queued.size,
  manual: manual.size,
  promo: promo.size,
  unaccounted,
  validBatchSize: valid.length,
  droppedCount: dropped.length,
  ts: new Date().toISOString()
};
// Atomic write to prevent half-written summary JSON
try { writeFileAtomic("/tmp/preflight-summary.json", JSON.stringify(summary)); } catch {}

// done
console.log('\n✅ PRE-FLIGHT PASSED\n');
process.exit(0);
