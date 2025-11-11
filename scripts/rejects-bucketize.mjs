#!/usr/bin/env node
/**
 * Bucket current rejects into machine-readable CSV files by errorCode
 *
 * Input: data/content/master/rejects.jsonl
 * Output: data/recovery/rejects-{errorCode}.csv
 *
 * Usage:
 *   node scripts/rejects-bucketize.mjs
 */

import fs from "fs";

const inFile = "data/content/master/rejects.jsonl";
const outDir = "data/recovery";

const buckets = {
  HTTP_404: new Set(),
  NETWORK_FETCH_FAIL: new Set(),
  INSUFFICIENT_EVIDENCE: new Set(),
  GUARDRAIL_FAIL: new Set(),
  RATE_LIMIT: new Set(),
  TIMEOUT: new Set(),
  OTHER: new Set(),
};

if (!fs.existsSync(inFile)) {
  console.error(`❌ File not found: ${inFile}`);
  process.exit(1);
}

console.log(`📖 Reading rejects from: ${inFile}`);
const lines = fs.readFileSync(inFile, "utf8").trim().split("\n");

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const o = JSON.parse(line);
    const slug = o.slug?.trim();
    if (!slug) continue;

    // Use errorCode if present, otherwise classify from error message
    const code = o.errorCode || (
      /404/i.test(o.error) ? "HTTP_404" :
      /evidence.*insufficient/i.test(o.error) ? "INSUFFICIENT_EVIDENCE" :
      /fetch failed/i.test(o.error) ? "NETWORK_FETCH_FAIL" :
      /guardrail/i.test(o.error) ? "GUARDRAIL_FAIL" :
      /grounding check failed/i.test(o.error) ? "GUARDRAIL_FAIL" :
      /repair failed/i.test(o.error) ? "GUARDRAIL_FAIL" :
      /primary keyword.*missing/i.test(o.error) ? "GUARDRAIL_FAIL" :
      /rate.*limit/i.test(o.error) ? "RATE_LIMIT" :
      /timeout/i.test(o.error) ? "TIMEOUT" : "OTHER"
    );

    const bucket = buckets[code] || buckets.OTHER;
    bucket.add(slug);
  } catch (parseErr) {
    console.warn(`⚠️  Skipped invalid JSON line: ${line.slice(0, 80)}...`);
  }
}

// Create output directory
fs.mkdirSync(outDir, { recursive: true });

// Write bucket CSV files
let total = 0;
console.log("\n📊 Bucket Summary:");
console.log("─".repeat(50));
for (const [code, set] of Object.entries(buckets)) {
  const arr = Array.from(set).sort();
  const outFile = `${outDir}/rejects-${code}.csv`;
  fs.writeFileSync(outFile, arr.join("\n") + "\n");
  console.log(`  ${code.padEnd(25)} ${String(arr.length).padStart(5)} slugs → ${outFile}`);
  total += arr.length;
}
console.log("─".repeat(50));
console.log(`  ${"TOTAL".padEnd(25)} ${String(total).padStart(5)} slugs`);
console.log("\n✅ Bucketization complete!");
console.log(`📁 Recovery files written to: ${outDir}/`);
