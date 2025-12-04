#!/usr/bin/env node
/**
 * Inject Unique Opening Lines into About Content
 *
 * - Uses analysis/openers/opening-lines.json
 * - For each entry:
 *    - Selects an opener deterministically based on slug
 *    - Wraps it in <p>...</p>
 *    - Prepends it to existing aboutcontent
 *
 * Meaning is preserved:
 * - We do NOT alter the existing aboutcontent text
 * - We ONLY add a new opening paragraph before it
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createHash } from 'crypto';

// ============================================================================
// CONFIG
// ============================================================================

const INPUT_FILE =
  process.argv[2] || 'data/content/master/successes-rewritten-grammar-fixed.jsonl';
const OPENERS_FILE = 'analysis/openers/opening-lines.json';
const OUTPUT_FILE =
  process.argv[3] || 'data/content/master/successes-final-with-openers.jsonl';

// ============================================================================
// UTILITIES
// ============================================================================

function loadOpeners() {
  if (!fs.existsSync(OPENERS_FILE)) {
    throw new Error(`Openers file not found: ${OPENERS_FILE}`);
  }

  const raw = fs.readFileSync(OPENERS_FILE, 'utf8');
  const data = JSON.parse(raw);

  if (!data.openers || !Array.isArray(data.openers) || data.openers.length === 0) {
    throw new Error('Openers file must contain a non-empty "openers" array.');
  }

  return data.openers.map(o => String(o).trim()).filter(o => o.length > 10);
}

function hashToIndex(slug, mod) {
  const h = createHash('md5').update(slug).digest('hex').slice(0, 8);
  const int = parseInt(h, 16);
  return int % mod;
}

function injectOpenerIntoAbout(aboutHtml, openerText) {
  if (!aboutHtml || typeof aboutHtml !== 'string' || !aboutHtml.trim()) {
    // No about content to prepend to – just return the opener as the whole aboutcontent
    return `<p>${openerText}</p>`;
  }

  const trimmed = aboutHtml.trim();

  // If about already starts with <p>, we simply prepend another <p>...</p> before it
  if (trimmed.toLowerCase().startsWith('<p')) {
    return `<p>${openerText}</p>` + trimmed;
  }

  // Otherwise, wrap existing content in a <p> as well to keep structure consistent
  return `<p>${openerText}</p><p>${trimmed}</p>`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const openers = loadOpeners();
  const openerCount = openers.length;

  console.log('='.repeat(60));
  console.log('INJECT UNIQUE OPENERS INTO ABOUT CONTENT');
  console.log('='.repeat(60));
  console.log(`Input JSONL:   ${INPUT_FILE}`);
  console.log(`Openers file:  ${OPENERS_FILE}`);
  console.log(`Output JSONL:  ${OUTPUT_FILE}`);
  console.log(`Total openers: ${openerCount}`);
  console.log('');

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  let total = 0;
  let modified = 0;

  const start = Date.now();

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      // If a line is invalid JSON, just pass it through unchanged
      outputStream.write(line + '\n');
      continue;
    }

    total++;

    // Every entry with a slug gets an opener (even if aboutcontent is empty/missing)
    if (entry.slug) {
      const idx = hashToIndex(entry.slug, openerCount);
      const opener = openers[idx];

      const newAbout = injectOpenerIntoAbout(entry.aboutcontent, opener);
      entry.aboutcontent = newAbout;
      modified++;
    }

    outputStream.write(JSON.stringify(entry) + '\n');

    if (total % 1000 === 0) {
      const elapsed = (Date.now() - start) / 1000;
      console.log(
        `Processed ${total} entries (${modified} with openers) ` +
        `– ${(total / elapsed).toFixed(1)} entries/sec`
      );
    }
  }

  outputStream.end();
  const elapsed = (Date.now() - start) / 1000;

  console.log('');
  console.log('='.repeat(60));
  console.log('OPENERS INJECTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total entries processed: ${total}`);
  console.log(`Entries with openers:   ${modified}`);
  console.log(`Time elapsed:           ${elapsed.toFixed(1)}s`);
  console.log(`Output file:            ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
