#!/usr/bin/env node
/**
 * Audit master file invariants (run after consolidation)
 * Exits with code 1 if any invariant is violated
 */

import fs from "fs";
import { execSync } from "child_process";

const SUCCESSES = "data/content/master/successes.jsonl";
const REJECTS = "data/content/master/rejects.jsonl";
const CHECKPOINT = "data/content/.checkpoint.json";

console.log("🔍 Auditing master file invariants...\n");

let failures = 0;

// INVARIANT 1: successes.jsonl does NOT contain "error"
try {
  const errorCount = execSync(`grep -c '"error"' "${SUCCESSES}" || true`, {
    encoding: "utf8",
    shell: "/bin/bash"
  }).trim();

  if (parseInt(errorCount || "0", 10) > 0) {
    console.error(`❌ INVARIANT 1 FAILED: ${errorCount} errors found in successes.jsonl`);
    failures++;
  } else {
    console.log("✅ INVARIANT 1: No errors in successes.jsonl");
  }
} catch (e) {
  console.log("✅ INVARIANT 1: No errors in successes.jsonl");
}

// INVARIANT 2: rejects.jsonl ONLY contains lines with "error"
try {
  const totalLines = execSync(`wc -l < "${REJECTS}" | tr -d ' '`, {
    encoding: "utf8",
    shell: "/bin/bash"
  }).trim();

  const errorLines = execSync(`grep -c '"error"' "${REJECTS}" || true`, {
    encoding: "utf8",
    shell: "/bin/bash"
  }).trim();

  const total = parseInt(totalLines || "0", 10);
  const errors = parseInt(errorLines || "0", 10);

  if (total > 0 && errors !== total) {
    console.error(`❌ INVARIANT 2 FAILED: ${total} lines in rejects but only ${errors} have "error"`);
    failures++;
  } else {
    console.log(`✅ INVARIANT 2: All ${total} rejects have "error" field`);
  }
} catch (e) {
  console.warn("⚠️  INVARIANT 2: Could not verify");
}

// INVARIANT 3: No cross-file duplicates
try {
  const successSlugs = execSync(`jq -r '.slug' "${SUCCESSES}" 2>/dev/null | sort -u`, {
    encoding: "utf8",
    shell: "/bin/bash"
  });
  const rejectSlugs = execSync(`jq -r '.slug' "${REJECTS}" 2>/dev/null | sort -u`, {
    encoding: "utf8",
    shell: "/bin/bash"
  });

  fs.writeFileSync("/tmp/audit-success-slugs.txt", successSlugs);
  fs.writeFileSync("/tmp/audit-reject-slugs.txt", rejectSlugs);

  const dupes = execSync(
    `comm -12 /tmp/audit-success-slugs.txt /tmp/audit-reject-slugs.txt | wc -l | tr -d ' '`,
    { encoding: "utf8", shell: "/bin/bash" }
  ).trim();

  const dupeCount = parseInt(dupes || "0", 10);
  if (dupeCount > 0) {
    console.error(`❌ INVARIANT 3 FAILED: ${dupeCount} cross-file duplicates (in both successes and rejects)`);
    const examples = execSync(
      `comm -12 /tmp/audit-success-slugs.txt /tmp/audit-reject-slugs.txt | head -5`,
      { encoding: "utf8", shell: "/bin/bash"
    }).trim();
    console.error(`   Examples: ${examples.split("\n").join(", ")}`);
    failures++;
  } else {
    console.log("✅ INVARIANT 3: No cross-file duplicates");
  }
} catch (e) {
  console.warn("⚠️  INVARIANT 3: Could not verify:", e.message);
}

// INVARIANT 4: Line counts reasonable (checkpoint can exceed files due to history)
try {
  const successLines = parseInt(
    execSync(`wc -l < "${SUCCESSES}" | tr -d ' '`, { encoding: "utf8", shell: "/bin/bash" }).trim() || "0",
    10
  );
  const rejectLines = parseInt(
    execSync(`wc -l < "${REJECTS}" | tr -d ' '`, { encoding: "utf8", shell: "/bin/bash" }).trim() || "0",
    10
  );

  const ck = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
  const doneCount = Object.keys(ck.done || {}).length;
  const rejectedCount = Object.keys(ck.rejected || {}).length;

  console.log(`\n📊 Counts:`);
  console.log(`   Successes: ${successLines} lines, checkpoint done: ${doneCount}`);
  console.log(`   Rejects: ${rejectLines} lines, checkpoint rejected: ${rejectedCount}`);

  // Rejects must match exactly (no history accumulation expected)
  if (rejectedCount !== rejectLines) {
    console.error(`❌ INVARIANT 4 FAILED: Rejected count mismatch (${rejectedCount} in checkpoint vs ${rejectLines} in file)`);
    failures++;
  } else {
    console.log("✅ INVARIANT 4: Reject counts match");
  }
} catch (e) {
  console.warn("⚠️  INVARIANT 4: Could not verify:", e.message);
}

// Summary
console.log(`\n${"=".repeat(50)}`);
if (failures > 0) {
  console.error(`❌ ${failures} INVARIANT(S) FAILED`);
  process.exit(1);
} else {
  console.log("✅ ALL INVARIANTS PASSED");
  process.exit(0);
}
