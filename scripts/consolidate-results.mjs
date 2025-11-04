#!/usr/bin/env node
// Consolidate raw batch outputs into master corpus files

import fs from "fs";
import path from "path";

const RAW_DIR = "data/content/raw";
const MASTER_DIR = "data/content/master";
const USAGE_FILE = "data/content/.usage.json";

// Ensure master directory exists
fs.mkdirSync(MASTER_DIR, { recursive: true });

const masterSuccess = path.join(MASTER_DIR, "successes.jsonl");
const masterRejects = path.join(MASTER_DIR, "rejects.jsonl");
const masterMeta = path.join(MASTER_DIR, "meta-runs.jsonl");

// Track what we process
let successCount = 0;
let rejectCount = 0;
let batchesProcessed = [];

// Helper to append safely and count lines
function appendLines(src, dest, trackCount = false) {
  if (!fs.existsSync(src)) return 0;
  const content = fs.readFileSync(src, "utf8").trim();
  if (!content) return 0;

  const lines = content.split("\n").filter(Boolean);
  fs.appendFileSync(dest, content + "\n");
  console.log(`✓ Appended ${lines.length} lines from ${path.basename(src)} → ${path.basename(dest)}`);

  return trackCount ? lines.length : 0;
}

// Load usage data for metadata
function loadUsage() {
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
  } catch {
    return { runs: [] };
  }
}

console.log("🔄 Consolidating batch results...\n");

// Get all raw files
const files = fs.readdirSync(RAW_DIR).sort();

// Process AI run outputs (successes)
const aiRunFiles = files.filter(f => /^ai-run-.*\.jsonl$/.test(f));
for (const f of aiRunFiles) {
  const full = path.join(RAW_DIR, f);
  const count = appendLines(full, masterSuccess, true);
  successCount += count;
  batchesProcessed.push(f);
}

// Process reject outputs
const rejectFiles = files.filter(f => /^rejects-.*\.jsonl$/.test(f));
for (const f of rejectFiles) {
  const full = path.join(RAW_DIR, f);
  const count = appendLines(full, masterRejects, true);
  rejectCount += count;
}

// Process meta files
const metaFiles = files.filter(f => /^ai-run-.*\.meta\.json$/.test(f));
for (const f of metaFiles) {
  const full = path.join(RAW_DIR, f);
  appendLines(full, masterMeta);
}

// Create consolidated metadata entry
const usage = loadUsage();
const latestRun = usage.runs && usage.runs.length > 0 ? usage.runs[usage.runs.length - 1] : null;

const metaEntry = {
  timestamp: new Date().toISOString(),
  batchesProcessed: batchesProcessed.length,
  batchNames: batchesProcessed,
  successCount,
  rejectCount,
  latestRunCost: latestRun ? latestRun.spentUSD : 0,
  latestRunItems: latestRun ? latestRun.itemsCompleted : 0,
  totalRuns: usage.runs ? usage.runs.length : 0,
  totalSpentUSD: usage.runs ? usage.runs.reduce((sum, r) => sum + (r.spentUSD || 0), 0) : 0
};

fs.appendFileSync(masterMeta, JSON.stringify(metaEntry) + "\n");

console.log("\n📊 Consolidation Summary:");
console.log(`  Successes: ${successCount} items → ${path.basename(masterSuccess)}`);
console.log(`  Rejects: ${rejectCount} items → ${path.basename(masterRejects)}`);
console.log(`  Batches: ${batchesProcessed.length} processed`);
if (latestRun) {
  console.log(`  Latest cost: $${latestRun.spentUSD.toFixed(4)} (${latestRun.itemsCompleted} items)`);
}
console.log(`  Total spent: $${metaEntry.totalSpentUSD.toFixed(2)}\n`);

console.log("✅ Consolidation complete!");
