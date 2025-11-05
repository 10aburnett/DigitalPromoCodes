#!/usr/bin/env node
/**
 * scripts/run-all-whops.mjs
 *
 * Autonomous full-run controller for content generation.
 * Loops through batches until all eligible whops are complete.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// === CONFIG ===
const BATCH_SIZE = 150;       // number of whops per batch
const BUDGET_USD = 10;        // per-batch cost cap
const BATCH_DELAY_MS = 20_000; // wait between batches (20s)
const MAX_RUNTIME_HOURS = 6;  // watchdog timeout
const SCOPE = process.env.SCOPE || 'all'; // 'promo' or 'all' (env override)
const ENV_SCRIPT = "/tmp/prod-cost-optimized-env.sh"; // your env file
const NEEDS_FILE = "/tmp/needs-content.csv";
const NEXT_BATCH_TXT = "/tmp/next-batch.txt";
const NEXT_BATCH_CSV = "/tmp/next-batch.csv";
const CRASH_LOG = "logs/crash.log";
const RUN_LOG = "logs/full-run.log";

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  try {
    const result = execSync(cmd, { stdio: "inherit", encoding: "utf8" });
    return result || "";
  } catch (err) {
    console.error(`⚠️ Command failed: ${cmd}\n`, err.message);
    throw err;
  }
}

function fileLineCount(p) {
  try {
    return fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

function fileExists(p) {
  return fs.existsSync(p);
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

async function main() {
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
======================================================
`);

  try {
    while (true) {
      batchNum++;

      // Watchdog timeout check
      const elapsedHours = (Date.now() - startTime) / (1000 * 60 * 60);
      if (elapsedHours > MAX_RUNTIME_HOURS) {
        console.log(`⏹️ ${MAX_RUNTIME_HOURS}-hour watchdog timeout — exiting safely.`);
        break;
      }

      console.log(`\n=== Batch ${batchNum} ===\n`);

      // Step 1: Refresh needs-content list
      console.log("📊 Step 1: Refreshing needs-content list...");
      run(`node scripts/query-whops-needing-content.mjs > ${NEEDS_FILE}`);

      // Step 2: Build the next live batch
      console.log("🎯 Step 2: Building next live batch...");
      run(`node scripts/build-next-batch.mjs ${BATCH_SIZE} --scope=${SCOPE}`);

      if (!fileExists(NEXT_BATCH_TXT)) {
        console.log("⚠️ Could not find next batch file, exiting.");
        break;
      }

      const remaining = fileLineCount(NEXT_BATCH_TXT);
      if (remaining === 0) {
        console.log("\n🎉 All whops successfully processed! No remaining items.\n");
        break;
      }

      console.log(`🧠 Next batch ready: ${remaining} items`);

      // Step 3: Run the generator with cost cap
      console.log("🤖 Step 3: Running generator...");
      run(
        `bash -c "rm -f data/content/raw/.run.lock && source ${ENV_SCRIPT} && node scripts/generate-whop-content.mjs --in=data/neon/whops.jsonl --onlySlugs=\\"$(cat ${NEXT_BATCH_CSV})\\" --batch=10 --budgetUsd=${BUDGET_USD}"`
      );

      // Step 4: Consolidate results idempotently
      console.log("📦 Step 4: Consolidating results...");
      run("node scripts/consolidate-results.mjs");

      // Step 5: Check whether more items remain
      console.log("🔍 Step 5: Checking for remaining items...");
      run(`node scripts/build-next-batch.mjs ${BATCH_SIZE} --scope=${SCOPE}`);
      const nextCount = fileLineCount(NEXT_BATCH_TXT);

      console.log(`\n✅ Batch ${batchNum} complete. Remaining whops: ${nextCount}`);

      if (nextCount === 0) {
        console.log("\n🎉 All whops successfully processed!\n");
        break;
      }

      console.log(`⏳ Waiting ${BATCH_DELAY_MS / 1000}s before next batch...\n`);
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    console.log("\n✅ Autonomous run completed successfully!");

  } catch (err) {
    console.error("\n🔥 Fatal error occurred!");
    console.error(err);
    logCrash(err, batchNum);
    process.exit(1);
  }
}

// Run with crash recovery
main().catch(err => {
  console.error("Unhandled error in main:", err);
  process.exit(1);
});
