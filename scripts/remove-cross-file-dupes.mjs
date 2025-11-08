#!/usr/bin/env node
/**
 * Remove cross-file duplicates (successes win over rejects)
 */

import fs from "fs";

const SUCCESSES = "data/content/master/successes.jsonl";
const REJECTS = "data/content/master/rejects.jsonl";

console.log("🔧 Removing cross-file duplicates (success-wins policy)...\n");

// Load all success slugs
const successSlugs = new Set();
const buf = fs.readFileSync(SUCCESSES, "utf8");
for (const line of buf.split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;
  try {
    const j = JSON.parse(t);
    if (j?.slug) successSlugs.add(j.slug);
  } catch {}
}

console.log(`Loaded ${successSlugs.size} success slugs`);

// Filter rejects - keep only those NOT in successes
const rejectLines = [];
let removed = 0;
const rejectBuf = fs.readFileSync(REJECTS, "utf8");
for (const line of rejectBuf.split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;

  try {
    const j = JSON.parse(t);
    if (j?.slug && successSlugs.has(j.slug)) {
      console.log(`  Removing ${j.slug} from rejects (exists in successes)`);
      removed++;
    } else {
      rejectLines.push(t);
    }
  } catch {
    rejectLines.push(t);
  }
}

console.log(`\n✅ Removed ${removed} duplicates from rejects`);

// Write back
fs.writeFileSync(REJECTS + ".backup-cross-dupes", rejectBuf);
fs.writeFileSync(REJECTS, rejectLines.join("\n") + "\n");
console.log(`✅ Updated ${REJECTS}`);
console.log(`   Backup: ${REJECTS}.backup-cross-dupes`);
