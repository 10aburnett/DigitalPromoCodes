#!/usr/bin/env node
// scripts/build-next-batch.mjs
//
// Dynamically build the next batch of whops to generate.
// NOW WITH: File lock + atomic queued-stamping to prevent race conditions
// Requires: /tmp/needs-content.csv and (optionally) data/promo-whop-slugs.txt when --scope=promo

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { loadState, isValidSlug, loadCheckpoint, PROMO_FILE, CHECKPOINT_FILE } from "./lib/sets.mjs";
import { withFileLock } from "./lib/withFileLock.mjs";
import { atomicWriteJson, atomicWriteText } from "./lib/atomic.mjs";

const OUT_TXT = "/tmp/next-batch.txt";
const OUT_CSV = "/tmp/next-batch.csv";
const LOCK_FILE = "build-next-batch";

// Load master indices to prevent re-processing already-done or rejected slugs
const MASTER_PROCESSED = "data/content/master/_processed-master-slugs.txt";
const MASTER_REJECTED  = "data/content/master/_rejected-master-slugs.txt";

function readLines(p) {
  try {
    return fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x);
  } catch {
    return [];
  }
}

// Parse args: --scope=promo|all --limit=<n> [positional batch size for backwards compat]
const args = process.argv.slice(2);

// Robust flag parsing
let batchSize = 150;  // default
let scope = 'promo';  // default

for (const arg of args) {
  if (arg.startsWith('--scope=')) {
    scope = arg.replace('--scope=', '');
  } else if (arg.startsWith('--limit=')) {
    batchSize = Number(arg.replace('--limit=', ''));
  } else if (!arg.startsWith('--') && !isNaN(Number(arg))) {
    // Backwards compat: positional number as batch size
    batchSize = Number(arg);
  }
}

// Validate
if (!['promo', 'all'].includes(scope)) {
  console.error('❌ Invalid scope. Use --scope=promo or --scope=all');
  process.exit(1);
}

if (isNaN(batchSize) || batchSize < 1) {
  console.error('❌ Invalid batch size. Use --limit=<positive number> or pass a number');
  process.exit(1);
}

const SCOPE = scope;

// WRAPPED IN FILE LOCK - prevents parallel builders from selecting same slugs
await withFileLock(LOCK_FILE, async () => {
  console.log('🔒 Acquired lock for batch construction...');

  // Load master indices (inside lock to get freshest state)
  const masterProcessed = fs.existsSync(MASTER_PROCESSED)
    ? new Set(readLines(MASTER_PROCESSED))
    : new Set();
  const masterRejected = fs.existsSync(MASTER_REJECTED)
    ? new Set(readLines(MASTER_REJECTED))
    : new Set();

  // Unified state load (needs, promo, manual, deny, done, rejected, queued)
  const { needs, promo, manual, deny, done, rejected, queued } = loadState();
  console.log(`📋 Loaded ${promo.size} promo whops from ${PROMO_FILE}`);
  console.log(`📊 Loaded ${needs.size} whops needing content`);
  console.log(`✅ Already done: ${done.size}, rejected: ${rejected.size}, queued: ${queued.size}, manual: ${manual.size}, denied: ${deny.size}`);
  console.log(`🔒 Master indices: ${masterProcessed.size} processed, ${masterRejected.size} rejected`);

  // compute live set:
  //   promo:   (promo ∩ needs) − (done ∪ rejected ∪ queued ∪ manual ∪ deny)
  //   all:     (needs − promo) − (done ∪ rejected ∪ queued ∪ manual ∪ deny)
  let candidates = SCOPE === 'promo'
    ? [...needs].filter(s => promo.has(s))   // Include only promo items
    : [...needs].filter(s => !promo.has(s)); // Exclude all promo items
  candidates = candidates
    .filter(isValidSlug)
    .filter(s => !done.has(s) && !rejected.has(s) && !queued.has(s) && !manual.has(s) && !deny.has(s))
    .filter(s => !masterProcessed.has(s) && !masterRejected.has(s)); // NEVER pick anything master already has

  // Candidate audit: Belt-and-braces check for ghost slugs that somehow slipped through
  const candidatesBeforeAudit = candidates.length;
  const ghostSlugs = candidates.filter(s => masterProcessed.has(s) || masterRejected.has(s));
  if (ghostSlugs.length > 0) {
    console.warn(`⚠️  Candidate audit caught ${ghostSlugs.length} ghost slugs that exist in master index. Excluding.`);
    const ghostSet = new Set(ghostSlugs);
    candidates = candidates.filter(s => !ghostSet.has(s));
  }
  console.log(`🔍 Candidate audit: before=${candidatesBeforeAudit}, after=${candidates.length}, removed=${candidatesBeforeAudit - candidates.length}`);

  console.log(`🔢 Candidates after audit: ${candidates.length}`);

  const targets = [];
  for (const s of candidates) {
    // For promo scope, skip regex filtering - rely on DB verification instead
    // This allows edge-case slugs like "-basic-access", "1", "dt" that have promo codes
    if (SCOPE === 'promo') {
      targets.push(s);  // DB verification will catch any invalid slugs
    } else {
      // For 'all' scope, apply hygiene filter
      if (/^[-a-z0-9][a-z0-9-]*$/i.test(s)) targets.push(s);
    }
  }

  targets.sort(); // deterministic order
  let nextBatch = targets.slice(0, batchSize);

  // FALLBACK: If candidates yielded nothing but checkpoint.queued has items, use those
  if (nextBatch.length === 0) {
    const checkpoint = loadCheckpoint();
    const queuedSlugs = Object.keys(checkpoint.queued || {});
    if (queuedSlugs.length > 0) {
      const pick = queuedSlugs.slice(0, batchSize);
      console.log(`🧰 Fallback: taking ${pick.length} slugs directly from checkpoint.queued`);

      // Write batch files immediately for fallback path
      await atomicWriteText(OUT_TXT, pick.join("\n"));
      await atomicWriteText(OUT_CSV, pick.join(","));

      console.log(`📝 Wrote ${pick.length} slugs → ${OUT_CSV} (fallback mode)`);
      console.log(
        `\n🎯 Built next batch (FALLBACK): scope=${SCOPE} size=${pick.length}\n` +
        `   → ${OUT_TXT}\n` +
        pick.slice(0, 10).join("\n") +
        (pick.length > 10 ? "\n…" : "")
      );
      return; // Exit early, files already written
    }

    console.log("✅ No new whops needing content (neither candidates nor checkpoint.queued had items).");
    process.exit(0);
  }

  // STRICT PROMO VERIFICATION: verify all candidates actually have promo codes in DB
  if (SCOPE === 'promo') {
    console.log(`\n🔒 Strict promo verification: checking ${nextBatch.length} candidates...`);
    const list = nextBatch.join(',');
    try {
      execSync(`node scripts/verify-promo-slugs.mjs "${list}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ Strict promo verification failed. Aborting batch build.');
      process.exit(2);
    }
  }

  // STAMP AS QUEUED in checkpoint (source of truth FIRST, files second)
  const checkpoint = loadCheckpoint();
  const batchId = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z-' +
                  crypto.randomBytes(2).toString('hex');
  const now = new Date().toISOString();

  for (const slug of nextBatch) {
    checkpoint.done ??= {};
    checkpoint.rejected ??= {};
    checkpoint.queued ??= {};

    // Stamp as queued with batch metadata
    checkpoint.queued[slug] = {
      batchId,
      queuedAt: now,
      scope: SCOPE
    };
    // Remove from done/rejected if somehow present (belt-and-braces)
    delete checkpoint.done[slug];
    delete checkpoint.rejected[slug];
  }

  // Atomic write to checkpoint (prevents half-written state)
  await atomicWriteJson(CHECKPOINT_FILE, checkpoint);
  console.log(`📌 Stamped ${nextBatch.length} slugs as queued in checkpoint (batchId: ${batchId})`);

  // THEN write batch files (convenience for downstream scripts)
  await atomicWriteText(OUT_TXT, nextBatch.join("\n"));
  await atomicWriteText(OUT_CSV, nextBatch.join(","));

  // Validate written batch (catch stale/malformed slugs)
  const builtBatch = readLines(OUT_TXT);
  const invalidSlugs = builtBatch.filter(s => !isValidSlug(s));
  if (invalidSlugs.length > 0) {
    console.error(`❌ Built batch contains ${invalidSlugs.length} invalid slugs`);
    console.error(`First 10 invalid: ${invalidSlugs.slice(0, 10).join(", ")}`);
    console.error(`Examples: "${invalidSlugs[0]}", "${invalidSlugs[1] || ''}"`);
    // Remove invalid batch file to prevent downstream use
    try {
      fs.unlinkSync(OUT_CSV);
      fs.unlinkSync(OUT_TXT);
    } catch {}
    process.exit(4);
  }

  console.log(
    `\n🎯 Built next batch: scope=${SCOPE} size=${nextBatch.length} batchId=${batchId}\n` +
    `   → ${OUT_TXT}\n` +
    nextBatch.slice(0, 10).join("\n") +
    (nextBatch.length > 10 ? "\n…" : "")
  );
}, { ttlMs: 120000 }); // 2 minute lock timeout
