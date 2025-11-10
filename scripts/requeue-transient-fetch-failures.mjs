#!/usr/bin/env node
// Requeue transient "evidence fetch failed" errors back to checkpoint.queued
// These are network/connectivity issues that should be retried

import fs from 'fs';

const rejPath = 'data/content/master/rejects.jsonl';
const ckPath = 'data/content/.checkpoint.json';

if (!fs.existsSync(rejPath)) {
  console.log('✅ No rejects file found, nothing to requeue');
  process.exit(0);
}

const lines = fs.readFileSync(rejPath, 'utf8').trim().split('\n').filter(Boolean);
const keep = [];
const trans = [];

console.log(`\n🔄 Analyzing ${lines.length} rejects for transient fetch failures...\n`);

for (const ln of lines) {
  try {
    const o = JSON.parse(ln);
    const msg = String(o.error || '').toLowerCase();

    // Transient error patterns
    if (msg.includes('evidence fetch failed: fetch failed')) {
      trans.push(o.slug);
      console.log(`  ♻️  Transient: ${o.slug} - ${o.error.substring(0, 60)}...`);
    } else {
      keep.push(ln);
    }
  } catch {
    // Malformed line, keep it
    keep.push(ln);
  }
}

// Rewrite rejects.jsonl with only hard failures
fs.writeFileSync(rejPath, keep.join('\n') + (keep.length ? '\n' : ''));
console.log(`\n✅ Kept ${keep.length} hard rejects in rejects.jsonl`);

// Load checkpoint and requeue transient failures
const ck = JSON.parse(fs.readFileSync(ckPath, 'utf8'));
ck.queued = ck.queued || {};
ck.rejected = ck.rejected || {};
ck.done = ck.done || {};

for (const s of trans) {
  // Remove from rejected and done
  delete ck.rejected[s];
  delete ck.done[s];
  // Add to queued
  ck.queued[s] = { reason: 'transient-evidence-fetch', queuedAt: new Date().toISOString() };
}

fs.writeFileSync(ckPath, JSON.stringify(ck, null, 2));

console.log(`✅ Requeued ${trans.length} transient fetch failures for retry`);
console.log(`\nSummary:`);
console.log(`  Hard rejects: ${keep.length}`);
console.log(`  Transient (requeued): ${trans.length}`);
console.log(`  Total queued now: ${Object.keys(ck.queued).length}\n`);
