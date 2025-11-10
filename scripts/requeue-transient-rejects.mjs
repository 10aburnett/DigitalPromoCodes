#!/usr/bin/env node
// Requeue transient rejects back into the processing queue
// Keeps only hard rejects (404, insufficient evidence, etc.)

import fs from 'fs';

const rejectsPath = 'data/content/master/rejects.jsonl';
const ckPath = 'data/content/.checkpoint.json';

const transient = [];
const hard = [];
const lines = fs.readFileSync(rejectsPath, 'utf8').trim().split('\n').filter(Boolean);

function isTransient(msg = '') {
  const s = msg.toLowerCase();
  return (
    s.includes('timeout') || s.includes('timed out') || s.includes('etimedout') ||
    s.includes('socket hang up') || s.includes('econnreset') || s.includes('enotfound') ||
    s.includes('network') || s.includes('overloaded') || s.includes('capacity') ||
    s.includes('rate limit') || s.includes('429') ||
    s.includes('token limit') || s.includes('context_length') || s.includes('max tokens') ||
    s.includes('context length') || s.includes('maximum context')
  );
}

console.log(`\n🔄 Analyzing ${lines.length} rejects...`);

for (const line of lines) {
  try {
    const o = JSON.parse(line);
    if (o?.error && isTransient(o.error)) {
      transient.push(o.slug);
      console.log(`  ♻️  Transient: ${o.slug} - ${o.error.substring(0, 60)}...`);
    } else {
      hard.push(line);
    }
  } catch {
    hard.push(line);
  }
}

// Rewrite rejects with only hard failures
fs.writeFileSync(rejectsPath, hard.join('\n') + (hard.length ? '\n' : ''));
console.log(`\n✅ Kept ${hard.length} hard rejects in rejects.jsonl`);

// Load checkpoint and requeue transient failures
const ck = JSON.parse(fs.readFileSync(ckPath, 'utf8'));
ck.queued = ck.queued || {};

for (const slug of transient) {
  delete ck.done?.[slug];
  delete ck.rejected?.[slug];
  ck.queued[slug] = { reason: 'transient-retry', queuedAt: new Date().toISOString() };
}

fs.writeFileSync(ckPath, JSON.stringify(ck, null, 2));

console.log(`✅ Requeued ${transient.length} transient rejects for retry`);
console.log(`\nSummary:`);
console.log(`  Hard rejects: ${hard.length}`);
console.log(`  Transient (requeued): ${transient.length}`);
console.log(`  Total queued now: ${Object.keys(ck.queued).length}\n`);
