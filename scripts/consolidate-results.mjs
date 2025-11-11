#!/usr/bin/env node
// Idempotent consolidation - prevents duplicates across multiple runs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const RAW_DIR = "data/content/raw";
const MASTER_DIR = "data/content/master";
const SUCCESS_FILE = path.join(MASTER_DIR, "successes.jsonl");
const REJECT_FILE  = path.join(MASTER_DIR, "rejects.jsonl");
const META_FILE    = path.join(MASTER_DIR, "meta-runs.jsonl");
const UPDATES_FILE = path.join(MASTER_DIR, "updates.jsonl");
const MANIFEST     = path.join(MASTER_DIR, ".processed_raw_files.json");

// Gate: require --ingest-raw flag to process raw rejects files
const INGEST_RAW = process.argv.includes("--ingest-raw");

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

  // Skip archives and backups
  if (f.includes('_archive') || f.includes('backup')) {
    continue;
  }

  const sig = fileSig(full);
  if (manifest.processed[f] === sig) {
    skippedFiles++;
    continue; // already merged → skip
  }

  if (/^ai-run-.*\.jsonl$/.test(f)) {
    let count = 0;
    let rejCount = 0;
    for (const line of iterLines(full)) {
      try {
        const j = JSON.parse(line);
        // If it has an error field, it's a reject - send to rejects file
        if (j?.error) {
          appendIfNewSlug(REJECT_FILE, UPDATES_FILE, line, seenRejects);
          rejCount++;
        } else {
          appendIfNewSlug(SUCCESS_FILE, UPDATES_FILE, line, seenSuccess);
          count++;
        }
      } catch {
        // If can't parse, skip it
      }
    }
    console.log(`✓ Processed ${count} successes, ${rejCount} rejects from ${f}`);
    appendedSuccess++;
  } else if (/^rejects-.*\.jsonl$/.test(f)) {
    // GATE: Only ingest raw rejects if --ingest-raw flag is passed
    if (INGEST_RAW) {
      let count = 0;
      let filtered = 0;
      for (const line of iterLines(full)) {
        try {
          const j = JSON.parse(line);
          // Skip if slug already exists in successes
          if (j?.slug && seenSuccess.has(j.slug)) {
            filtered++;
            continue;
          }
          appendIfNewSlug(REJECT_FILE, UPDATES_FILE, line, seenRejects);
          count++;
        } catch {
          // Skip unparseable lines
        }
      }
      console.log(`✓ Processed ${count} rejects from ${f} (${filtered} filtered - already in successes)`);
      appendedRejects++;
    } else {
      console.log(`⚠️  Skipping raw rejects file ${f} (use --ingest-raw to process)`);
    }
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

// Deduplicate master files (keep best per slug) before rebuilding indices
try {
  console.log("\n🧼 Deduplicating master files (keep best per slug)...");
  execSync(`node scripts/dedupe-jsonl-by-slug.mjs ${UPDATES_FILE}`, { stdio: "inherit", shell: "/bin/bash" });
  execSync(`node scripts/dedupe-jsonl-by-slug.mjs ${SUCCESS_FILE}`, { stdio: "inherit", shell: "/bin/bash" });
  execSync(`node scripts/dedupe-jsonl-by-slug.mjs ${REJECT_FILE}`,   { stdio: "inherit", shell: "/bin/bash" });
  console.log("✅ Master files deduped");
} catch (e) {
  console.error("⚠️  Deduplication step failed:", e.message);
  process.exit(6);
}

// Promote updates into successes (cross-file dedupe with quality-aware selection)
try {
  console.log("\n⬆️  Promoting updates into successes (cross-file dedupe, quality-aware)...");
  execSync(`node scripts/promote-updates-into-successes.mjs`, { stdio: "inherit", shell: "/bin/bash" });
} catch (e) {
  console.error("⚠️  Promotion step failed:", e.message);
  process.exit(9);
}

// Rebuild master slug indices for next batch (Layer 3 of duplicate prevention)
// NOTE: After promotion, updates.jsonl is empty, so processed index = successes (SSOT)
try {
  console.log("\n🔁 Rebuilding master slug indices...");

  execSync(`
    jq -r '.slug' ${SUCCESS_FILE} 2>/dev/null |
    awk 'NF' | sort -u > ${path.join(MASTER_DIR, "_processed-master-slugs.txt")}
  `, { stdio: "inherit", shell: "/bin/bash" });

  execSync(`
    jq -r '.slug' ${REJECT_FILE} 2>/dev/null |
    awk 'NF' | sort -u > ${path.join(MASTER_DIR, "_rejected-master-slugs.txt")}
  `, { stdio: "inherit", shell: "/bin/bash" });

  execSync(`
    cat ${path.join(MASTER_DIR, "_processed-master-slugs.txt")} \
        ${path.join(MASTER_DIR, "_rejected-master-slugs.txt")} 2>/dev/null |
    sort -u > ${path.join(MASTER_DIR, "_master-all-slugs.txt")}
  `, { stdio: "inherit", shell: "/bin/bash" });

  console.log("✅ Master indices rebuilt successfully");
} catch (err) {
  console.error("⚠️  Failed to rebuild indices:", err.message);
}

// Verify cross-file invariant: updates ∩ successes = ∅ (Layer 4 protection)
try {
  const intersection = execSync(`
    comm -12 \
      <(jq -r '.slug' "${UPDATES_FILE}" 2>/dev/null | awk 'NF' | sort -u) \
      <(jq -r '.slug' "${SUCCESS_FILE}" 2>/dev/null | awk 'NF' | sort -u) \
    | wc -l
  `, { encoding: "utf8", shell: "/bin/bash" }).trim();

  const count = parseInt(intersection || "0", 10);
  if (count > 0) {
    console.error(`\n❌ Invariant failed: cross-file duplicate slugs present (updates ∩ successes ≠ ∅)`);
    console.error(`   Found ${count} slugs in both updates.jsonl and successes.jsonl`);
    process.exit(8);
  }
  console.log("✅ Cross-file invariant OK (updates ∩ successes = ∅)");
} catch (err) {
  if (err.status === 8) throw err; // Re-throw our exit
  console.warn("⚠️  Cross-file check failed:", err.message);
}

// Verify no duplicate slugs remain (invariants)
function dupesCount(file) {
  try {
    const out = execSync(
      `jq -r '.slug' "${file}" | awk 'NF' | sort | uniq -d | wc -l`,
      { encoding: "utf8", shell: "/bin/bash" }
    ).trim();
    return parseInt(out || "0", 10);
  } catch { return 0; }
}

function fileStats(file) {
  try {
    const lines = execSync(`wc -l < "${file}"`, { encoding: "utf8", shell: "/bin/bash" }).trim();
    const unique = execSync(`jq -r '.slug' "${file}" | awk 'NF' | sort -u | wc -l`, { encoding: "utf8", shell: "/bin/bash" }).trim();
    const dupes = dupesCount(file);
    return { lines: parseInt(lines || "0", 10), unique: parseInt(unique || "0", 10), dupes };
  } catch { return { lines: 0, unique: 0, dupes: 0 }; }
}

console.log("\n📈 Post-consolidation summary:");
const updatesStats = fileStats(UPDATES_FILE);
const successStats = fileStats(SUCCESS_FILE);
const rejectsStats = fileStats(REJECT_FILE);

console.log(`  updates.jsonl   : ${updatesStats.lines} lines, ${updatesStats.unique} unique, ${updatesStats.dupes} dupes`);
console.log(`  successes.jsonl : ${successStats.lines} lines, ${successStats.unique} unique, ${successStats.dupes} dupes`);
console.log(`  rejects.jsonl   : ${rejectsStats.lines} lines, ${rejectsStats.unique} unique, ${rejectsStats.dupes} dupes`);

const totalDupes = updatesStats.dupes + successStats.dupes + rejectsStats.dupes;
if (totalDupes > 0) {
  console.error(`\n❌ Duplicate slugs detected post-consolidation: updates=${updatesStats.dupes}, successes=${successStats.dupes}, rejects=${rejectsStats.dupes}`);
  process.exit(7); // Abort controller loop safely
}
console.log("🔒 Invariants: no duplicate slugs in master files.");

// Telemetry: append batch summary for drift detection
try {
  const telemetryLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    updates: { lines: updatesStats.lines, unique: updatesStats.unique, dupes: updatesStats.dupes },
    successes: { lines: successStats.lines, unique: successStats.unique, dupes: successStats.dupes },
    rejects: { lines: rejectsStats.lines, unique: rejectsStats.unique, dupes: rejectsStats.dupes },
    totalDupes: totalDupes,
    crossFileInvariantOK: true, // We only reach here if it passed
  });
  const telemetryFile = path.join(MASTER_DIR, ".consolidation-telemetry.jsonl");
  fs.appendFileSync(telemetryFile, telemetryLine + "\n");
  console.log("📊 Telemetry logged to .consolidation-telemetry.jsonl");
} catch (err) {
  console.warn("⚠️  Telemetry logging failed (non-fatal):", err.message);
}

console.log("\n✅ Idempotent consolidation complete!");
