#!/usr/bin/env node
// Idempotent consolidation - prevents duplicates across multiple runs
import fs from "fs";
import path from "path";

const RAW_DIR = "data/content/raw";
const MASTER_DIR = "data/content/master";
const SUCCESS_FILE = path.join(MASTER_DIR, "successes.jsonl");
const REJECT_FILE  = path.join(MASTER_DIR, "rejects.jsonl");
const META_FILE    = path.join(MASTER_DIR, "meta-runs.jsonl");
const UPDATES_FILE = path.join(MASTER_DIR, "updates.jsonl");
const MANIFEST     = path.join(MASTER_DIR, ".processed_raw_files.json");

// ---------- helpers ----------
fs.mkdirSync(MASTER_DIR, { recursive: true });

// File lock to prevent concurrent consolidations
const LOCK = path.join(MASTER_DIR, ".consolidate.lock");
if (fs.existsSync(LOCK)) {
  console.error("❌ Consolidator is already running (lock present).");
  process.exit(1);
}
fs.writeFileSync(LOCK, String(process.pid));
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch {} });

function loadJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return def; }
}

function saveJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

// Atomic append to avoid partial writes
function appendAtomic(p, data) {
  const tmp = p + ".tmp-" + Date.now();
  fs.writeFileSync(tmp, data);
  if (!fs.existsSync(p)) fs.writeFileSync(p, ""); // ensure file exists
  const existing = fs.readFileSync(p, "utf8");
  fs.writeFileSync(p, existing + data);
  fs.unlinkSync(tmp);
}

function fileSig(p) {
  const s = fs.statSync(p);
  return `${s.size}-${s.mtimeMs}`; // cheap & stable signature
}

function* iterLines(p) {
  const buf = fs.readFileSync(p, "utf8");
  for (const line of buf.split(/\r?\n/)) {
    const t = line.trim();
    if (t) yield t;
  }
}

// Build in-memory set of already-seen slugs
function loadSeenSlugs(file) {
  const set = new Set();
  if (!fs.existsSync(file)) return set;
  for (const line of iterLines(file)) {
    try {
      const j = JSON.parse(line);
      if (j?.slug) set.add(j.slug);
    } catch {}
  }
  return set;
}

// Append if slug not seen; if same slug but different content, send to updates file
function appendIfNewSlug(dest, updatesDest, line, seen) {
  try {
    const j = JSON.parse(line);
    const slug = j?.slug;
    if (!slug) return;
    if (seen.has(slug)) {
      // Content drift - capture as update instead of duplicating
      appendAtomic(updatesDest, line + "\n");
      return;
    }
    appendAtomic(dest, line + "\n");
    seen.add(slug);
  } catch {}
}

// ---------- main ----------
console.log("🔄 Idempotent consolidation starting...\n");

const manifest = loadJSON(MANIFEST, { processed: {} });
const seenSuccess = loadSeenSlugs(SUCCESS_FILE);
const seenRejects = loadSeenSlugs(REJECT_FILE);

let appendedSuccess = 0;
let appendedRejects = 0;
let appendedMeta = 0;
let skippedFiles = 0;

for (const f of fs.readdirSync(RAW_DIR)) {
  const full = path.join(RAW_DIR, f);
  if (!fs.statSync(full).isFile()) continue;

  const sig = fileSig(full);
  if (manifest.processed[f] === sig) {
    skippedFiles++;
    continue; // already merged → skip
  }

  if (/^ai-run-.*\.jsonl$/.test(f)) {
    let count = 0;
    for (const line of iterLines(full)) {
      appendIfNewSlug(SUCCESS_FILE, UPDATES_FILE, line, seenSuccess);
      count++;
    }
    console.log(`✓ Processed ${count} items from ${f}`);
    appendedSuccess++;
  } else if (/^rejects-.*\.jsonl$/.test(f)) {
    let count = 0;
    for (const line of iterLines(full)) {
      appendIfNewSlug(REJECT_FILE, UPDATES_FILE, line, seenRejects);
      count++;
    }
    console.log(`✓ Processed ${count} rejects from ${f}`);
    appendedRejects++;
  } else if (/meta.*\.json$/i.test(f)) {
    const content = fs.readFileSync(full, "utf8").trim();
    if (content) {
      appendAtomic(META_FILE, content + "\n");
      appendedMeta++;
    }
  }

  manifest.processed[f] = sig;
}

saveJSON(MANIFEST, manifest);

console.log(`\n📊 Consolidation complete:
  + Success files merged: ${appendedSuccess}
  + Reject files merged:  ${appendedRejects}
  + Meta files merged:    ${appendedMeta}
  - Files skipped (already processed): ${skippedFiles}

  Master successes: ${seenSuccess.size} unique slugs
  Master rejects: ${seenRejects.size} unique slugs`);

console.log("\n✅ Idempotent consolidation complete!");
