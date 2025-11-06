#!/usr/bin/env node
// scripts/build-next-batch.mjs
//
// Dynamically build the next batch of whops to generate.
// Requires: /tmp/needs-content.csv and (optionally) data/promo-whop-slugs.txt when --scope=promo

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const PROMO_FILE = "data/promo-whop-slugs.txt";
const CHECKPOINT = "data/content/.checkpoint.json";
const NEEDS_FILE = "/tmp/needs-content.csv";
const OUT_TXT = "/tmp/next-batch.txt";
const OUT_CSV = "/tmp/next-batch.csv";

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

// ALWAYS load fresh promo list from file for promo scope
let promo = null;
if (SCOPE === 'promo') {
  if (!fs.existsSync(PROMO_FILE)) {
    console.error(`❌ Promo scope requires ${PROMO_FILE} - run scripts/query-promo-whops.mjs first`);
    process.exit(1);
  }
  promo = new Set(readLines(PROMO_FILE));
  console.log(`📋 Loaded ${promo.size} promo whops from ${PROMO_FILE}`);
}

const needs = new Set(readLines(NEEDS_FILE));
console.log(`📊 Loaded ${needs.size} whops needing content`);

const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
const done = new Set(Object.keys(checkpoint.done || {}));
const rejected = new Set(Object.keys(checkpoint.rejected || {}));
const MANUAL_FILE = "data/manual/promo-manual-content.txt";
const manual = new Set(readLines(MANUAL_FILE));
const DENY_FILE = "data/manual/denylist.txt";
const deny = new Set(readLines(DENY_FILE));
console.log(`✅ Already done: ${done.size}, rejected: ${rejected.size}, manual: ${manual.size}, denied: ${deny.size}`);

// compute live set:
//   promo:   (promo ∩ needs) − (done ∪ rejected ∪ manual ∪ deny)
//   all:     (needs) − (done ∪ rejected ∪ manual ∪ deny)
let candidates = SCOPE === 'promo' ? [...needs].filter(s => promo.has(s)) : [...needs];
candidates = candidates.filter(s => !done.has(s) && !rejected.has(s) && !manual.has(s) && !deny.has(s));

console.log(`🔢 Candidates before filtering: ${candidates.length}`);

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
const nextBatch = targets.slice(0, batchSize);

if (nextBatch.length === 0) {
  console.log("✅ No new whops needing content.");
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

fs.writeFileSync(OUT_TXT, nextBatch.join("\n"));
fs.writeFileSync(OUT_CSV, nextBatch.join(","));

// Validate written batch (catch stale/malformed slugs)
const builtBatch = readLines(OUT_TXT);  // Read TXT file (newline-separated)
const invalidSlugs = builtBatch.filter(s => !s || s === "-" || /\s/.test(s));
if (invalidSlugs.length > 0) {
  console.error(`❌ Built batch contains ${invalidSlugs.length} invalid slugs`);
  console.error(`First 10 invalid: ${invalidSlugs.slice(0, 10).join(", ")}`);
  console.error(`Examples: "${invalidSlugs[0]}", "${invalidSlugs[1] || ''}"`);
  // Remove invalid batch file to prevent downstream use
  try { fs.unlinkSync(OUT_CSV); fs.unlinkSync(OUT_TXT); } catch {}
  process.exit(4);
}

console.log(
  `\n🎯 Built next batch: scope=${SCOPE} size=${nextBatch.length} → ${OUT_TXT}\n` +
  nextBatch.slice(0, 10).join("\n") +
  (nextBatch.length > 10 ? "\n…" : "")
);
