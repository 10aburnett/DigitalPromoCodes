#!/usr/bin/env node
/**
 * Promote updates into successes (cross-file dedupe with quality-aware selection)
 *
 * Strategy: Make successes.jsonl the SSOT (single source of truth).
 * - Read both updates.jsonl and successes.jsonl
 * - Pick the BEST version per slug (quality-aware scoring)
 * - Write all best versions to successes.jsonl
 * - Clear updates.jsonl
 *
 * This enforces Invariant 2: no slug appears in both files.
 */

import fs from "fs";
import path from "path";

const UPDATES = "data/content/master/updates.jsonl";
const SUCCESSES = "data/content/master/successes.jsonl";

console.log("⬆️  Promoting updates into successes (cross-file dedupe, quality-aware)...\n");

function readJsonl(file) {
  const out = [];
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      // CRITICAL: Skip items with "error" field (they belong in rejects, not successes)
      if (obj?.error) {
        console.log(`  ⚠️  Skipping ${obj.slug} from ${path.basename(file)} (has error field)`);
        continue;
      }
      out.push({ obj, raw: t, src: path.basename(file) });
    } catch {}
  }
  return out;
}

const CORE_FIELDS = [
  "aboutcontent",
  "howtoredeemcontent",
  "promodetailscontent",
  "termscontent",
  "faqcontent",
];

const textLen = (v) => (typeof v === "string" ? v.length : 0);
const has = (o, k) => o && o[k] != null && String(o[k]).trim() !== "";

function timestampOf(o) {
  const cands = [o?.generatedAt, o?.updatedAt, o?.ts, o?.__meta?.timestamp];
  for (const v of cands) {
    if (!v) continue;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    if (typeof v === "number") return v;
  }
  return 0;
}

function score(rec) {
  const o = rec.obj || {};
  let filled = 0;
  let len = 0;
  for (const k of CORE_FIELDS) {
    if (has(o, k)) {
      filled++;
      len += textLen(o[k]);
    }
  }
  const ts = timestampOf(o);
  // Prefer updates.jsonl as tie-breaker (assume it's newer)
  const srcScore = rec.src.includes("updates") ? 1 : 0;
  return { filled, len, ts, srcScore };
}

function better(a, b) {
  const sa = score(a), sb = score(b);
  if (sa.filled !== sb.filled) return sa.filled > sb.filled ? a : b;
  if (sa.len !== sb.len)       return sa.len     > sb.len     ? a : b;
  if (sa.ts !== sb.ts)         return sa.ts      > sb.ts      ? a : b;
  if (sa.srcScore !== sb.srcScore) return sa.srcScore > sb.srcScore ? a : b;
  return a; // Stable tie-breaker
}

function writeAtomic(file, content) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

const updates = readJsonl(UPDATES);
const successes = readJsonl(SUCCESSES);

console.log(`  Read ${updates.length} updates, ${successes.length} successes`);

// Build map: slug → best record
const bySlug = new Map();
for (const r of [...updates, ...successes]) {
  const s = r.obj?.slug?.trim();
  if (!s) continue;
  const prev = bySlug.get(s);
  bySlug.set(s, prev ? better(r, prev) : r);
}

// Extract best raw lines
const nextSuccess = [];
for (const [, rec] of bySlug) {
  nextSuccess.push(rec.raw);
}

// Write atomically
writeAtomic(SUCCESSES, nextSuccess.join("\n") + (nextSuccess.length ? "\n" : ""));
writeAtomic(UPDATES, ""); // Zero out updates for clean invariant

console.log(`✅ Promoted ${updates.length} updates + ${successes.length} successes → ${nextSuccess.length} unique in successes.jsonl`);
console.log(`✅ Cleared updates.jsonl (now empty)\n`);
