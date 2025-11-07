#!/usr/bin/env node
/**
 * Deduplicate a JSONL file by slug with quality-aware selection.
 *
 * - Canonicalises slug: trim + lowercase.
 * - Drops exact duplicate objects.
 * - If multiple records share a slug, picks the "best":
 *    1) Prefer record with a later timestamp (ts|updatedAt|modifiedAt) if available.
 *    2) Otherwise prefer the one with the most complete fields present among:
 *       aboutcontent, howtoredeemcontent, promodetailscontent, termscontent, faqcontent
 *    3) Tie-breaker: longest total HTML length across the four HTML fields.
 *    4) Final tie-breaker: keep the later (last) line.
 * - Writes atomically: .tmp -> rename
 *
 * Usage:
 *   node scripts/dedupe-jsonl-by-slug.mjs data/content/master/updates.jsonl
 */
import fs from "fs";
import crypto from "crypto";

function canonicalSlug(s) {
  return (s || "").trim().toLowerCase();
}

function parseTs(obj) {
  const keys = ["ts", "updatedAt", "modifiedAt", "updated_at", "modified_at"];
  for (const k of keys) {
    const v = obj?.[k];
    if (!v) continue;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    if (typeof v === "number") return v; // epoch ms
  }
  return 0; // unknown
}

function htmlLen(s) {
  return typeof s === "string" ? s.length : 0;
}

function completenessScore(o) {
  let c = 0;
  if (o?.aboutcontent) c++;
  if (o?.howtoredeemcontent) c++;
  if (o?.promodetailscontent) c++;
  if (o?.termscontent) c++;
  if (Array.isArray(o?.faqcontent) && o.faqcontent.length >= 4) c++;
  return c;
}

function qualityScore(o) {
  const fieldsLen =
    htmlLen(o?.aboutcontent) +
    htmlLen(o?.howtoredeemcontent) +
    htmlLen(o?.promodetailscontent) +
    htmlLen(o?.termscontent);
  return {
    ts: parseTs(o),
    complete: completenessScore(o),
    html: fieldsLen,
  };
}

// returns true if a is better than b
function better(a, b) {
  const A = qualityScore(a);
  const B = qualityScore(b);
  if (A.ts !== B.ts) return A.ts > B.ts;
  if (A.complete !== B.complete) return A.complete > B.complete;
  if (A.html !== B.html) return A.html > B.html;
  return true; // tie-breaker: keep later (caller feeds lines in order)
}

function writeAtomic(path, content) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, path);
}

function safeParse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

const inPath = process.argv[2];
if (!inPath) {
  console.error("Usage: node scripts/dedupe-jsonl-by-slug.mjs <file.jsonl>");
  process.exit(1);
}

const buf = fs.readFileSync(inPath, "utf8");
const seenHash = new Set();
const bySlug = new Map();

let total = 0, parsed = 0, kept = 0, droppedDupLine = 0, replacedWorse = 0;

for (const line of buf.split(/\r?\n/)) {
  total++;
  const raw = line.trim();
  if (!raw) continue;
  const hash = crypto.createHash("sha1").update(raw).digest("hex");
  if (seenHash.has(hash)) { droppedDupLine++; continue; }
  seenHash.add(hash);

  const obj = safeParse(raw);
  if (!obj || !obj.slug) continue;
  parsed++;

  const slug = canonicalSlug(obj.slug);
  obj.slug = slug; // normalise in output

  if (!bySlug.has(slug)) {
    bySlug.set(slug, obj);
    kept++;
  } else {
    const current = bySlug.get(slug);
    // keep the better one; if tie, keep the later (this line)
    if (!better(current, obj)) {
      bySlug.set(slug, obj);
      replacedWorse++;
    } else {
      // current is better; do nothing
    }
  }
}

const out = [...bySlug.values()].map(o => JSON.stringify(o)).join("\n") + "\n";
writeAtomic(inPath, out);

console.log(`✅ Deduped ${inPath}
  lines_total        : ${total}
  json_parsed        : ${parsed}
  exact_line_dropped : ${droppedDupLine}
  unique_slugs_final : ${bySlug.size}
  replaced_worse     : ${replacedWorse}
`);
