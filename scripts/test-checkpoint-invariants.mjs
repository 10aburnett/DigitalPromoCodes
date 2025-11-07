#!/usr/bin/env node
/**
 * Test checkpoint invariants
 *
 * Verifies that done ∩ rejected = ∅ (no overlap between done and rejected sets)
 * This prevents identity inflation and ensures state integrity
 */
import fs from "fs";

const CHECKPOINT_PATH = "data/content/.checkpoint.json";

// Load checkpoint
if (!fs.existsSync(CHECKPOINT_PATH)) {
  console.error(`❌ Checkpoint file not found: ${CHECKPOINT_PATH}`);
  process.exit(1);
}

const ck = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
ck.done ||= {};
ck.rejected ||= {};

const D = new Set(Object.keys(ck.done));
const R = new Set(Object.keys(ck.rejected));

// Check for overlap
let overlap = 0;
const overlapping = [];
for (const slug of D) {
  if (R.has(slug)) {
    overlap++;
    if (overlapping.length < 10) overlapping.push(slug);
  }
}

if (overlap > 0) {
  console.error(`❌ Invariant failed: done ∩ rejected = ${overlap}`);
  console.error(`First 10 overlapping slugs:\n  ${overlapping.join('\n  ')}`);
  console.error(`\nThis violates the success-wins policy and will cause identity inflation.`);
  console.error(`Run: node scripts/fix-checkpoint-overlap.mjs`);
  process.exit(1);
}

console.log(`✅ Invariants OK (no done ∩ rejected)`);
console.log(`  Done: ${D.size}`);
console.log(`  Rejected: ${R.size}`);
console.log(`  Overlap: ${overlap}`);
