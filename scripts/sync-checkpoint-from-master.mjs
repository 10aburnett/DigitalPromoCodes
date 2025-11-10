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
ck.queued ||= {};

const beforeDone = Object.keys(ck.done || {}).length;
const beforeRejected = Object.keys(ck.rejected || {}).length;

// AUTHORITATIVE SYNC: master files are source of truth
// Build sets from master files
const succSlugs = new Set([...iterSlugs(MASTER_UPDATES), ...iterSlugs(MASTER_SUCCESSES)]);
const rejSlugs = new Set(iterSlugs(MASTER_REJECTS));

// Rebuild done/rejected maps from scratch (authoritative)
ck.done = {};
ck.rejected = {};
let promotedFromReject = 0;

// Master successes become done (SUCCESS WINS)
for (const slug of succSlugs) {
  ck.done[slug] = { when: new Date().toISOString(), why: "synced_from_master" };
  // If it was previously rejected but now succeeded, that's a promotion
  if (rejSlugs.has(slug)) {
    promotedFromReject++;
  }
}

// Master rejects become rejected (unless already in done - success wins)
for (const slug of rejSlugs) {
  if (!ck.done[slug]) {
    ck.rejected[slug] = { when: new Date().toISOString(), why: "synced_from_master_rejects" };
  }
}

const afterDone = Object.keys(ck.done).length;
const afterRejected = Object.keys(ck.rejected).length;

// Clean queued items that are already in done or rejected
ck.queued ||= {};
let queuedCleaned = 0;
for (const slug of Object.keys(ck.queued)) {
  if (ck.done[slug] || ck.rejected[slug]) {
    delete ck.queued[slug];
    queuedCleaned++;
  }
}

// Write back atomically
writeFileAtomic(CHECKPOINT_PATH, JSON.stringify(ck, null, 2));

console.log(`✅ Checkpoint synced (success-wins + atomic)!
  Done: ${beforeDone} → ${afterDone} (+${afterDone - beforeDone})
  Rejected: ${beforeRejected} → ${afterRejected} (${afterRejected - beforeRejected >= 0 ? "+" : ""}${afterRejected - beforeRejected})
  Promoted from reject: ${promotedFromReject}
  Queued cleaned: ${queuedCleaned}
`);
