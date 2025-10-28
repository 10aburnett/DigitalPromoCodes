#!/usr/bin/env node
/**
 * Real-time monitoring dashboard for whop content generation.
 * Watches checkpoint, output files, and calculates ETA + projected spend.
 *
 * Usage:
 *   node scripts/monitor-whop-progress.mjs --provider=openai --target=8500 --budget=50
 *
 * Displays:
 *   - Completed / total whops
 *   - Current success rate
 *   - Token usage (input/output)
 *   - Estimated cost
 *   - Projected total cost
 *   - ETA to completion
 *   - Recent slugs processed
 *   - Desktop notifications (completion, budget warnings)
 */

import fs from "fs";
import path from "path";
import { exec } from "child_process";

const CHECKPOINT = "data/content/.checkpoint.json";
const OUT_DIR = "data/content/raw";
const USAGE_FILE = "data/content/.usage.json";
const REFRESH_INTERVAL = 5000; // 5 seconds

// CLI args
const ARGS = Object.fromEntries(process.argv.slice(2).map(a=>{
  const m=a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a,true];
}));
const TARGET = ARGS.target ? Number(ARGS.target) : 0;        // e.g., 8500
const PROVIDER = (ARGS.provider || "openai").toLowerCase();  // openai|anthropic
const BUDGET = ARGS.budget ? Number(ARGS.budget) : 0;        // e.g., 50

// Pricing (adjust if needed)
const PRICE = {
  openai:   { in: 0.00015/1000, out: 0.00060/1000 },
  anthropic:{ in: 0.00080/1000, out: 0.00120/1000 }
};

let startTime = Date.now();
let lastCompletedCount = 0;
let notifiedComplete = false;
let notifiedBudget = false;
let lastBytes = 0;
let staleTicks = 0;

function notify(title, message) {
  const platform = process.platform;
  if (platform === "darwin") {
    exec(`osascript -e 'display notification "${message.replace(/"/g,'\\\"')}" with title "${title.replace(/"/g,'\\\"')}"'`, err => { /* ignore */ });
  } else if (platform === "linux") {
    exec(`notify-send "${title.replace(/"/g,'\\\"')}" "${message.replace(/"/g,'\\\"')}"`, err => { /* ignore */ });
  } else {
    // Fallback: terminal bell + log
    process.stdout.write("\x07");
    console.log(`[NOTICE] ${title}: ${message}`);
  }
}

function findLatestOutputFile() {
  if (!fs.existsSync(OUT_DIR)) return null;
  const files = fs.readdirSync(OUT_DIR)
    .filter(f => f.startsWith("ai-run-") && f.endsWith(".jsonl"))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(OUT_DIR, files[0]) : null;
}

function readCheckpoint() {
  if (!fs.existsSync(CHECKPOINT)) return { done: {}, pending: {} };
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
  } catch {
    return { done: {}, pending: {} };
  }
}

function countOutputLines(file) {
  if (!file || !fs.existsSync(file)) return 0;
  const content = fs.readFileSync(file, "utf8");
  return content.split("\n").filter(Boolean).length;
}

function getRecentSlugs(file, count = 5) {
  if (!file || !fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n").filter(Boolean);
  const recent = lines.slice(-count);
  return recent.map(line => {
    try {
      const obj = JSON.parse(line);
      return obj.slug || "unknown";
    } catch {
      return "parse-error";
    }
  });
}

function estimateTokens(completedCount) {
  // Rough estimates; tune if you measure differently in your logs
  const avgInputPerWhop = 500;
  const avgOutputPerWhop = 800;
  return {
    input: completedCount * avgInputPerWhop,
    output: completedCount * avgOutputPerWhop
  };
}

function calculateCost(tokens, provider = "openai") {
  const p = PRICE[provider] || PRICE.openai;
  return (tokens.input * p.in) + (tokens.output * p.out);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function clear() {
  process.stdout.write("\x1B[2J\x1B[0f");
}

function render() {
  const ck = readCheckpoint();
  const doneCount = Object.keys(ck.done || {}).length;
  const pendingCount = Object.keys(ck.pending || {}).length;
  const outFile = findLatestOutputFile();
  const outputLines = countOutputLines(outFile);
  const recentSlugs = getRecentSlugs(outFile);

  // Stall detection: check if output file is growing
  const size = outFile && fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
  if (size > lastBytes || pendingCount === 0) {
    staleTicks = 0;
  } else {
    staleTicks++;
  }
  lastBytes = size;

  // Read run metadata if available
  const latestMeta = outFile ? (outFile.replace(/\.jsonl$/, ".meta.json")) : null;
  let meta = null;
  if (latestMeta && fs.existsSync(latestMeta)) {
    try { meta = JSON.parse(fs.readFileSync(latestMeta, "utf8")); } catch {}
  }

  const elapsed = Date.now() - startTime;
  const rate = doneCount / (elapsed / 1000); // whops per second

  // Prefer real token usage over estimates
  let tokens;
  if (fs.existsSync(USAGE_FILE)) {
    try { tokens = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")); } catch {}
  }
  const estimatedTokens = estimateTokens(doneCount);
  const liveTokens = (tokens && typeof tokens.input === "number" && typeof tokens.output === "number") ? tokens : estimatedTokens;

  // Use metadata provider or fallback to CLI arg
  const providerForCost = (meta?.provider || PROVIDER || "openai").toLowerCase();
  const estimatedCost = calculateCost(liveTokens, providerForCost);

  // Project totals (prefer meta limit, then CLI target, then heuristic)
  const totalEstimate = TARGET > 0 ? TARGET : (meta?.limit || (doneCount > 100 ? Math.ceil(doneCount / 0.01) : 8000));

  // Guard against negative/wild projections when doneCount is very small
  const perWhop = doneCount > 0 ? estimatedCost / doneCount : 0;
  const projectedCost = perWhop * Math.max(1, totalEstimate);

  // ETA
  const remaining = totalEstimate - doneCount;
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  const etaMs = etaSeconds * 1000;

  clear();

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         WHOP CONTENT GENERATION - LIVE MONITOR           ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");

  console.log("📊 Progress:");
  console.log(`   Completed:     ${doneCount.toLocaleString()} whops`);
  console.log(`   In Progress:   ${pendingCount} whops`);
  console.log(`   Output Lines:  ${outputLines.toLocaleString()}`);
  const denom = Math.max(1, doneCount + pendingCount);
  const succ = ((doneCount / denom) * 100).toFixed(1);
  console.log(`   Success Rate:  ~${succ}%`);
  console.log("");

  // Show model info from metadata if available
  if (meta && (meta.provider || meta.model)) {
    console.log("🤖 Models:");
    if (meta.provider) console.log(`   Provider:      ${meta.provider}`);
    if (meta.model) console.log(`   Main Model:    ${meta.model}`);
    if (meta.strongModel) console.log(`   Strong Model:  ${meta.strongModel}`);
    console.log("");
  }

  console.log("⏱️  Timing:");
  console.log(`   Elapsed:       ${formatDuration(elapsed)}`);
  console.log(`   Rate:          ${rate > 0 ? rate.toFixed(2) : "0.00"} whops/sec`);
  console.log(`   ETA:           ${rate > 0 ? formatDuration(etaMs) : "calculating..."}`);
  console.log("");

  const isRealData = tokens && typeof tokens.input === "number";
  console.log(`💰 Cost ${isRealData ? '(live data)' : `(${providerForCost} estimates)`}:`);
  console.log(`   Tokens:        ${liveTokens.input.toLocaleString()} in, ${liveTokens.output.toLocaleString()} out`);
  console.log(`   Current:       $${estimatedCost.toFixed(4)}`);
  console.log(`   Per Whop:      $${doneCount > 0 ? (estimatedCost/doneCount).toFixed(6) : "0.000000"}`);
  console.log(`   Projected:     $${projectedCost.toFixed(2)} (for ~${totalEstimate.toLocaleString()} total)`);
  if (BUDGET > 0) {
    const budgetRemaining = BUDGET - projectedCost;
    const budgetStatus = budgetRemaining > 0 ? `✅ $${budgetRemaining.toFixed(2)} remaining` : `⚠️  $${Math.abs(budgetRemaining).toFixed(2)} over budget`;
    console.log(`   Budget:        ${budgetStatus}`);
  }
  console.log("");

  console.log("📝 Recent Completions:");
  if (recentSlugs.length > 0) {
    recentSlugs.reverse().forEach((slug, i) => {
      console.log(`   ${i+1}. ${slug}`);
    });
  } else {
    console.log("   (none yet)");
  }
  console.log("");

  console.log("💾 Files:");
  console.log(`   Checkpoint:    ${CHECKPOINT}`);
  if (outFile) {
    console.log(`   Output:        ${path.basename(outFile)}`);
  }
  console.log("");

  console.log("Press Ctrl+C to exit monitoring (won't stop generation)");
  console.log("─────────────────────────────────────────────────────────────");

  // Notifications
  if (BUDGET && projectedCost > BUDGET && !notifiedBudget && doneCount > 0) {
    notifiedBudget = true;
    notify("Whop Generation: Budget Warning",
      `Projected cost $${projectedCost.toFixed(2)} exceeds budget $${BUDGET.toFixed(2)}.`);
  }
  if (!notifiedComplete && TARGET > 0 && doneCount >= TARGET && (pendingCount === 0)) {
    notifiedComplete = true;
    notify("Whop Generation: Completed",
      `Done ${doneCount.toLocaleString()} items (target ${TARGET.toLocaleString()}).`);
  }

  // Stall warning: if pending exists but no output growth for ~30s (6 ticks × 5s)
  if (staleTicks >= 6 && pendingCount > 0) {
    console.log("");
    console.log("⚠️  Pipeline looks stalled (no output growth). Check logs or network.");
    notify("Whop Generation: Stalled?", "No new output detected for ~30 seconds.");
  }
}

// Initial check
if (!fs.existsSync(CHECKPOINT)) {
  console.log("⚠️  No checkpoint found. Generation hasn't started yet.");
  console.log("   Run: node scripts/generate-whop-content.mjs ...");
  process.exit(0);
}

console.log(`🔍 Monitoring started. Refreshing every ${REFRESH_INTERVAL/1000}s...\n`);
if (TARGET > 0) console.log(`Target: ${TARGET.toLocaleString()} whops`);
if (PROVIDER) console.log(`Provider: ${PROVIDER}`);
if (BUDGET > 0) console.log(`Budget: $${BUDGET.toFixed(2)}`);
console.log("Press Ctrl+C to exit\n");

// Start monitoring loop
setInterval(render, REFRESH_INTERVAL);
render(); // Initial render

// Graceful exit
process.on("SIGINT", () => {
  clear();
  console.log("\n👋 Monitor stopped. Generation continues in background.\n");
  process.exit(0);
});
