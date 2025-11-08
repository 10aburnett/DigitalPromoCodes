#!/usr/bin/env node
/**
 * Sync checkpoint from master files (SUCCESS-WINS POLICY)
 *
 * Problem: consolidate-results.mjs merges content into master/ but doesn't update .checkpoint.json
 * Solution: Read all slugs from master files and mark them in checkpoint
 * Policy: Success wins - done removes from rejected (no D∩R overlap)
 */

import fs from "fs";

const CHECKPOINT_PATH = "data/content/.checkpoint.json";
const MASTER_UPDATES = "data/content/master/updates.jsonl";
const MASTER_SUCCESSES = "data/content/master/successes.jsonl";
const MASTER_REJECTS = "data/content/master/rejects.jsonl";

console.log("🔄 Syncing checkpoint from master files (success-wins policy)...\n");

// Atomic write helper
function writeFileAtomic(path, content) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, path);
}

// Helper to read slugs from JSONL
function iterSlugs(file) {
  if (!fs.existsSync(file)) return [];
  const slugs = [];
  const buf = fs.readFileSync(file, "utf8");
  for (const line of buf.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j = JSON.parse(t);
      if (j?.slug) slugs.push(j.slug);
    } catch {}
  }
  return slugs;
}

// Load checkpoint
const ck = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
ck.done ||= {};
ck.rejected ||= {};

const beforeDone = Object.keys(ck.done).length;
const beforeRejected = Object.keys(ck.rejected).length;
let promotedFromReject = 0;

// Sync updates + successes → done (SUCCESS WINS)
for (const file of [MASTER_UPDATES, MASTER_SUCCESSES]) {
  const source = file.includes("updates") ? "updates" : "successes";
  for (const slug of iterSlugs(file)) {
    if (!ck.done[slug]) {
      ck.done[slug] = { when: new Date().toISOString(), why: `synced_from_master_${source}` };
    }
    // SUCCESS WINS: Remove from rejected if present
    if (ck.rejected[slug]) {
      delete ck.rejected[slug];
      promotedFromReject++;
    }
  }
}

// Sync rejects → rejected
// CRITICAL: Remove from done if in rejects (fix for misplaced rejects bug)
for (const slug of iterSlugs(MASTER_REJECTS)) {
  if (!ck.rejected[slug]) {
    ck.rejected[slug] = { when: new Date().toISOString(), why: "synced_from_master_rejects" };
  }
  // Remove from done if mistakenly marked as done
  if (ck.done[slug]) {
    delete ck.done[slug];
    console.log(`  ⚠️  Moved ${slug} from done → rejected (was misplaced)`);
  }
}

const afterDone = Object.keys(ck.done).length;
const afterRejected = Object.keys(ck.rejected).length;

// Write back atomically
writeFileAtomic(CHECKPOINT_PATH, JSON.stringify(ck, null, 2));

console.log(`✅ Checkpoint synced (success-wins + atomic)!
  Done: ${beforeDone} → ${afterDone} (+${afterDone - beforeDone})
  Rejected: ${beforeRejected} → ${afterRejected} (${afterRejected - beforeRejected >= 0 ? "+" : ""}${afterRejected - beforeRejected})
  Promoted from reject: ${promotedFromReject}
`);
