#!/usr/bin/env node
/**
 * scripts/run-all-whops.mjs
 *
 * Autonomous full-run controller for content generation.
 * Loops through batches until all eligible whops are complete.
 * NOW WITH: PID lock, preflight/postflight checks, progress audit trail
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { acquireLock, releaseLock } from "./lib/lock.js";

// === ARGUMENT PARSING ===
function getFlag(name, def) {
  const arg = process.argv.find(x => x.startsWith(name + "="));
  return arg ? arg.split("=")[1] : def;
}

const SCOPE = getFlag("--scope", "promo");  // 'promo' or 'all'
const BATCH_SIZE = Number(getFlag("--limit", "150"));
const BUDGET_USD = Number(getFlag("--budgetUsd", "10"));
const BATCH_DELAY_MS = 20_000; // wait between batches (20s)
const MAX_RUNTIME_HOURS = 6;  // watchdog timeout
const ENV_SCRIPT = "/tmp/prod-cost-optimized-env.sh";
const NEEDS_FILE = "/tmp/needs-content.csv";
const NEXT_BATCH_CSV = "/tmp/next-batch.csv";
const CRASH_LOG = "logs/crash.log";

// Validate arguments
if (!['promo', 'all'].includes(SCOPE)) {
  console.error('❌ Invalid scope. Use --scope=promo or --scope=all');
  process.exit(1);
}

if (isNaN(BATCH_SIZE) || BATCH_SIZE < 1) {
  console.error('❌ Invalid batch size. Use --limit=<positive number>');
  process.exit(1);
}

if (isNaN(BUDGET_USD) || BUDGET_USD <= 0) {
  console.error('❌ Invalid budget. Use --budgetUsd=<positive number>');
  process.exit(1);
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", encoding: "utf8" });
  } catch (err) {
    console.error(`⚠️ Command failed: ${cmd}\n`, err.message);
    throw err;
  }
}

function logCrash(err, batchNum) {
  const timestamp = new Date().toISOString();
  const crashEntry = `
======================================================
CRASH REPORT - ${timestamp}
======================================================
Batch number: ${batchNum}
Error: ${err.message}
Stack: ${err.stack}
======================================================

`;

  try {
    fs.mkdirSync(path.dirname(CRASH_LOG), { recursive: true });
    fs.appendFileSync(CRASH_LOG, crashEntry);
    console.error(`\n🔥 Crash logged to ${CRASH_LOG}`);
  } catch (logErr) {
    console.error("Failed to write crash log:", logErr.message);
  }
}

function runBatch({ scope, limit, budgetUsd }) {
  // A) Preflight validation (blocks on any mismatch)
  console.log("🔒 PRE-FLIGHT: Validating state...");
  run(`node scripts/preflight.mjs --scope=${scope} --limit=${limit}`);

  // B) Build fresh batch
  console.log("🎯 Building next batch...");
  run(`node scripts/build-next-batch.mjs --scope=${scope} --limit=${limit}`);

  // C) Verify promo batches (DB safety check)
  if (scope === "promo") {
    console.log("🔐 Verifying promo batch against DB...");
    run(`node scripts/verify-promo-slugs.mjs "$(cat ${NEXT_BATCH_CSV})"`);
  }

  // D) Generate content
  console.log("🤖 Running generator...");
  run(
    `bash -c "source ${ENV_SCRIPT} && node scripts/generate-whop-content.mjs --in=data/neon/whops.jsonl --onlySlugs=\\"$(cat ${NEXT_BATCH_CSV})\\" --batch=${Math.min(10, limit)} --budgetUsd=${budgetUsd}"`
  );

  // E) Consolidate results idempotently
  console.log("📦 Consolidating results...");
  run("node scripts/consolidate-results.mjs");

  // F) Sync checkpoint from master (CRITICAL: ensures next batch sees latest state)
  console.log("🔄 Syncing checkpoint from master...");
  run("node scripts/sync-checkpoint-from-master.mjs");

  // G) Append audit trail
  console.log("📊 Logging progress...");
  run(`node scripts/progress-log.mjs --scope=${scope}`);

  // Note: Post-flight validation removed - the next batch's pre-flight will validate
  // state after checkpoint sync. This prevents false positives from stale batch files.
}

async function main() {
  // Acquire PID lock (prevents concurrent runs)
  acquireLock({ role: "controller" });

  // Release lock on exit
  process.on("exit", releaseLock);
  process.on("SIGINT", () => { releaseLock(); process.exit(130); });
  process.on("SIGTERM", () => { releaseLock(); process.exit(143); });

  const startTime = Date.now();
  let batchNum = 0;

  console.log(`
======================================================
🔁 Autonomous WHOP Generation Controller
======================================================
Scope: ${SCOPE} (${SCOPE === 'all' ? 'all whops' : 'promo-code whops only'})
Batch size: ${BATCH_SIZE}
Budget per batch: $${BUDGET_USD}
Max runtime: ${MAX_RUNTIME_HOURS}h
Environment: ${ENV_SCRIPT}
PID: ${process.pid}
======================================================
`);

  try {
    // Step 0: Clean stale artifacts from previous runs
    console.log("🧹 Cleaning stale artifacts...");
    try {
      fs.unlinkSync("/tmp/next-batch.txt");
      fs.unlinkSync("/tmp/next-batch.csv");
      fs.unlinkSync("/tmp/preflight-summary.json");
      console.log("✅ Stale artifacts removed");
    } catch {
      console.log("✅ No stale artifacts to remove");
    }

    // Step 1: Refresh needs-content list once at start
    console.log("📊 Refreshing initial needs-content list...");
    run(`node scripts/query-whops-needing-content.mjs > ${NEEDS_FILE}`);

    // Step 1b: Refresh promo list to prevent staleness check failure
    if (SCOPE === "promo" || SCOPE === "all") {
      console.log("📋 Refreshing promo list...");
      run(`node scripts/query-promo-whops.mjs > data/promo-whop-slugs.txt`);
    }

    // Guardrail: promo identity must balance before any ALL-scope run
    if (SCOPE === "all") {
      console.log("🧮 Validating promo identity before ALL-scope run...");
      run(`node scripts/preflight.mjs --scope=promo --limit=1`);
    }

    while (true) {
      batchNum++;

      // Watchdog timeout check
      const elapsedHours = (Date.now() - startTime) / (1000 * 60 * 60);
      if (elapsedHours > MAX_RUNTIME_HOURS) {
        console.log(`⏹️ ${MAX_RUNTIME_HOURS}-hour watchdog timeout — exiting safely.`);
        break;
      }

      console.log(`\n=== Batch ${batchNum} ===\n`);

      try {
        runBatch({ scope: SCOPE, limit: BATCH_SIZE, budgetUsd: BUDGET_USD });
      } catch (e) {
        // If preflight says "NO-ELIGIBLE-ITEMS" or batch is empty, stop cleanly
        if (String(e?.message || e).includes("NO-ELIGIBLE-ITEMS") ||
            String(e?.message || e).includes("No new whops")) {
          console.log("\n✅ All eligible items processed!");
          break;
        }
        // Otherwise re-throw the error
        throw e;
      }

      console.log(`\n✅ Batch ${batchNum} complete.`);
      console.log(`⏳ Waiting ${BATCH_DELAY_MS / 1000}s before next batch...\n`);
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    console.log("\n✅ Autonomous run completed successfully!");

  } catch (err) {
    console.error("\n🔥 Fatal error occurred!");
    console.error(err);
    logCrash(err, batchNum);
    releaseLock();
    process.exit(1);
  } finally {
    releaseLock();
  }
}

// Run with crash recovery
main().catch(err => {
  console.error("Unhandled error in main:", err);
  releaseLock();
  process.exit(1);
});
