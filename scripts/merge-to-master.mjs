#!/usr/bin/env node
/**
 * Merges rewritten content into the master successes.jsonl file
 * Replaces entries with matching slugs, preserves all others
 */

import fs from 'fs';

const MASTER_FILE = 'data/content/master/successes.jsonl';
const NEW_CONTENT_FILE = process.argv[2] || 'data/content/raw/ai-run-20251104T180924.FINAL.jsonl';
const BACKUP_FILE = MASTER_FILE + '.backup-' + Date.now();

// Read new content and index by slug
const newContent = new Map();
const newLines = fs.readFileSync(NEW_CONTENT_FILE, 'utf8').trim().split('\n');
for (const line of newLines) {
  const obj = JSON.parse(line);
  newContent.set(obj.slug, obj);
}
console.log(`Loaded ${newContent.size} new entries from ${NEW_CONTENT_FILE}`);

// Backup master file
fs.copyFileSync(MASTER_FILE, BACKUP_FILE);
console.log(`Backed up master to ${BACKUP_FILE}`);

// Read master and replace matching entries
const masterLines = fs.readFileSync(MASTER_FILE, 'utf8').trim().split('\n');
console.log(`Master file has ${masterLines.length} entries`);

let replaced = 0;
const outputLines = [];

for (const line of masterLines) {
  const obj = JSON.parse(line);
  if (newContent.has(obj.slug)) {
    // Replace with new content
    outputLines.push(JSON.stringify(newContent.get(obj.slug)));
    replaced++;
  } else {
    // Keep original
    outputLines.push(line);
  }
}

// Write updated master
fs.writeFileSync(MASTER_FILE, outputLines.join('\n') + '\n');

console.log(`\nDone! Replaced ${replaced} entries in master`);
console.log(`Expected: ${newContent.size}, Got: ${replaced}`);
if (replaced !== newContent.size) {
  console.log(`WARNING: Some slugs not found in master!`);
  for (const slug of newContent.keys()) {
    const found = masterLines.some(line => line.includes(`"slug":"${slug}"`));
    if (!found) console.log(`  Missing: ${slug}`);
  }
}
