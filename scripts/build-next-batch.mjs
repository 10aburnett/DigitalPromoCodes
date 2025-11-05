#!/usr/bin/env node
// scripts/build-next-batch.mjs
//
// Dynamically build the next batch of whops to generate.
// Requires: /tmp/needs-content.csv and (optionally) data/promo-whop-slugs.txt when --scope=promo

import fs from "fs";
import path from "path";

const PROMO_FILE = "data/promo-whop-slugs.txt";
const CHECKPOINT = "data/content/.checkpoint.json";
const NEEDS_FILE = "/tmp/needs-content.csv";
const OUT_TXT = "/tmp/next-batch.txt";
const OUT_CSV = "/tmp/next-batch.csv";

// Parse args: [batchSize] [--scope=promo|all]
const args = process.argv.slice(2);
const batchSize = Number(args[0] || 150);
const scopeArg = args.find(a => a.startsWith('--scope=')) || '--scope=promo';
const SCOPE = scopeArg.replace(/^--scope=/, ''); // 'promo' | 'all'

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

// Load promo set only if scope is 'promo'
let promo = null;
if (SCOPE === 'promo') {
  promo = new Set(readLines(PROMO_FILE));
}

const needs = new Set(readLines(NEEDS_FILE));

const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
const done = new Set(Object.keys(checkpoint.done || {}));
const rejected = new Set(Object.keys(checkpoint.rejected || {}));

// compute live set:
//   promo:   (promo ∩ needs) − (done ∪ rejected)
//   all:     (needs) − (done ∪ rejected)
let candidates = SCOPE === 'promo' ? [...needs].filter(s => promo.has(s)) : [...needs];
candidates = candidates.filter(s => !done.has(s) && !rejected.has(s));

const targets = [];
for (const s of candidates) {
  if (/^[A-Za-z0-9][A-Za-z0-9-]{2,}$/.test(s)) targets.push(s);
}

targets.sort(); // deterministic order
const nextBatch = targets.slice(0, batchSize);

if (nextBatch.length === 0) {
  console.log("✅ No new whops needing content.");
  process.exit(0);
}

fs.writeFileSync(OUT_TXT, nextBatch.join("\n"));
fs.writeFileSync(OUT_CSV, nextBatch.join(","));
console.log(
  `🎯 Built next batch: scope=${SCOPE} size=${nextBatch.length} → ${OUT_TXT}\n` +
  nextBatch.slice(0, 10).join("\n") +
  (nextBatch.length > 10 ? "\n…" : "")
);
