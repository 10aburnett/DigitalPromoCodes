#!/usr/bin/env node
/**
 * scripts/audit-promo-coverage.mjs
 *
 * Verifies coverage of all promo whops across:
 *   - successes (master successes.jsonl + checkpoint.done)
 *   - rejects   (master rejects.jsonl  + checkpoint.rejected)
 *   - queue     (/tmp/next-batch.txt if present)
 *
 * Outputs:
 *   - A coverage summary with exact counts
 *   - /tmp/promo-missing.txt : any promo slugs not covered
 *   - /tmp/promo-duplicates.txt : slugs that appear in more than one bucket (should be 0)
 *   - /tmp/promo-nonpromo-in-sets.txt : slugs in your sets that DON'T currently have a promo in DB (anomalies)
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const MASTER_DIR = "data/content/raw";
const CHECKPOINT = "data/content/.checkpoint.json";
const SUCCESS_FILE = path.join(MASTER_DIR, "ai-run-20251104T180924.jsonl");
const REJECT_FILE  = path.join(MASTER_DIR, "rejects-20251104T180924.jsonl");
const QUEUE_FILE   = "/tmp/next-batch.txt";

// ---------- helpers ----------
function* iterJsonl(file) {
  if (!fs.existsSync(file)) return;
  const buf = fs.readFileSync(file, "utf8");
  for (const line of buf.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { yield JSON.parse(t); } catch {}
  }
}
function readSlugsFromJsonl(file) {
  const s = new Set();
  for (const j of iterJsonl(file)) {
    if (j?.slug) s.add(String(j.slug));
  }
  return s;
}
function readSlugsFromTxt(file) {
  try {
    return new Set(
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}
function readCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
  } catch {
    return { done: {}, rejected: {} };
  }
}
function union(...sets) {
  const u = new Set();
  for (const s of sets) for (const v of s) u.add(v);
  return u;
}
function intersection(a, b) {
  const out = new Set();
  for (const v of a) if (b.has(v)) out.add(v);
  return out;
}
function difference(a, b) {
  const out = new Set();
  for (const v of a) if (!b.has(v)) out.add(v);
  return out;
}

async function main() {
  // 1) Pull fresh PROMO set from DB
  const promos = await prisma.deal.findMany({
    where: { PromoCode: { some: {} } },
    select: { slug: true, _count: { select: { PromoCode: true } } },
  });
  const promoSlugs = new Set(promos.map(r => String(r.slug)));

  // 2) Load successes, rejects, queue, checkpoint
  const successMaster = readSlugsFromJsonl(SUCCESS_FILE);
  const rejectMaster  = readSlugsFromJsonl(REJECT_FILE);

  const ck = readCheckpoint();
  const successCk = new Set(Object.keys(ck.done || {}));
  const rejectCk  = new Set(Object.keys(ck.rejected || {}));

  const queue = readSlugsFromTxt(QUEUE_FILE);

  // 3) Normalize canonical buckets
  const successes = union(successMaster, successCk);
  const rejects   = union(rejectMaster, rejectCk);
  const covered   = union(successes, rejects, queue);

  // 4) Compute missing + duplicates
  const missing   = difference(promoSlugs, covered);

  const dup_sr    = intersection(successes, rejects);
  const dup_sq    = intersection(successes, queue);
  const dup_rq    = intersection(rejects, queue);
  const duplicates = union(dup_sr, dup_sq, dup_rq);

  // 5) Sanity: verify that members of your sets are still promo in DB (schema drift, data changes)
  const nonPromoInSets = difference(covered, promoSlugs);

  // 6) Save lists for inspection
  fs.writeFileSync("/tmp/promo-missing.txt", [...missing].sort().join("\n"));
  fs.writeFileSync("/tmp/promo-duplicates.txt", [...duplicates].sort().join("\n"));
  fs.writeFileSync("/tmp/promo-nonpromo-in-sets.txt", [...nonPromoInSets].sort().join("\n"));

  // 7) Print summary
  console.log("=== PROMO COVERAGE AUDIT ===");
  console.log(`Promo slugs in DB:        ${promoSlugs.size}`);
  console.log(`Successes (master+ck):    ${successes.size}`);
  console.log(`Rejects   (master+ck):    ${rejects.size}`);
  console.log(`Current queue (/tmp):     ${queue.size}`);
  console.log(`----------------------------------------`);
  console.log(`Covered total (unique):   ${covered.size}`);
  console.log(`MISSING (promo - covered): ${missing.size}`);
  console.log(`Duplicates across buckets: ${duplicates.size}`);
  console.log(`Non-promo present in sets: ${nonPromoInSets.size}`);
  console.log("");
  if (missing.size) {
    console.log("⚠️  First few missing:", [...missing].slice(0, 20).join(", "));
  }
  if (duplicates.size) {
    console.log("⚠️  First few duplicates:", [...duplicates].slice(0, 20).join(", "));
  }
  if (nonPromoInSets.size) {
    console.log("⚠️  First few non-promo-in-sets:", [...nonPromoInSets].slice(0, 20).join(", "));
  }
  console.log("\nFiles written:");
  console.log(" - /tmp/promo-missing.txt");
  console.log(" - /tmp/promo-duplicates.txt");
  console.log(" - /tmp/promo-nonpromo-in-sets.txt");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
