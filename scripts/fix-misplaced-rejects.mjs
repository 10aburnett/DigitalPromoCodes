#!/usr/bin/env node
/**
 * Fix misplaced rejects in successes.jsonl
 * Moves items with "error" field from successes → rejects
 */

import fs from "fs";

const SUCCESSES = "data/content/master/successes.jsonl";
const REJECTS = "data/content/master/rejects.jsonl";
const SUCCESSES_CLEAN = "data/content/master/successes.clean.jsonl";

console.log("🔧 Fixing misplaced rejects in successes.jsonl...\n");

const successLines = [];
const rejectLines = [];
let movedCount = 0;

// Read successes and separate into clean successes vs rejects
const buf = fs.readFileSync(SUCCESSES, "utf8");
for (const line of buf.split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;

  try {
    const j = JSON.parse(t);

    // If it has an error field, it's a reject
    if (j.error) {
      // Convert to minimal reject format
      rejectLines.push(JSON.stringify({ slug: j.slug, error: j.error }));
      movedCount++;
    } else {
      // Keep as success
      successLines.push(t);
    }
  } catch (e) {
    console.warn(`⚠️  Failed to parse line: ${t.substring(0, 50)}...`);
    successLines.push(t); // Keep unparseable lines in successes
  }
}

console.log(`Found ${movedCount} misplaced rejects in successes.jsonl`);
console.log(`Clean successes: ${successLines.length}`);

// Write clean successes
fs.writeFileSync(SUCCESSES_CLEAN, successLines.join("\n") + "\n");
console.log(`✅ Wrote clean successes to ${SUCCESSES_CLEAN}`);

// Append rejects to rejects file
if (rejectLines.length > 0) {
  const existingRejects = fs.readFileSync(REJECTS, "utf8");
  fs.writeFileSync(REJECTS, existingRejects + rejectLines.join("\n") + "\n");
  console.log(`✅ Appended ${rejectLines.length} items to ${REJECTS}`);
}

// Backup original and replace
fs.renameSync(SUCCESSES, `${SUCCESSES}.backup-misplaced-rejects`);
fs.renameSync(SUCCESSES_CLEAN, SUCCESSES);
console.log(`✅ Replaced successes.jsonl with clean version`);
console.log(`   Original backed up to successes.jsonl.backup-misplaced-rejects`);

console.log("\n✅ Fix complete!");
console.log(`   Moved ${movedCount} rejects from successes → rejects`);
