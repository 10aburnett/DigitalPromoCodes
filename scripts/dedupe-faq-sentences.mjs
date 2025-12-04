#!/usr/bin/env node
/**
 * FAQ SENTENCE DEDUPING SCRIPT (INTRA-WHOP)
 *
 * For each JSONL entry:
 *  - Looks at `faqcontent` (array of { question, answerHtml })
 *  - Ensures that NO sentence appears more than once across ALL answers
 *    for that whop (case-insensitive, whitespace-normalised)
 *  - Sentences are extracted from plain text (HTML stripped) using .?! as delimiters
 *
 * Usage:
 *   node scripts/dedupe-faq-sentences.mjs input.jsonl output.jsonl
 *
 * Defaults:
 *   input:  data/content/master/successes-final-with-openers.jsonl
 *   output: data/content/master/successes-faq-deduped.jsonl
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const INPUT_FILE =
  process.argv[2] || 'data/content/master/successes-final-with-openers.jsonl';

const OUTPUT_FILE =
  process.argv[3] || 'data/content/master/successes-faq-deduped.jsonl';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Split a plain-text string into sentences based on . ? !
 * Returns an array of strings with punctuation kept.
 */
function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];

  const parts = text.split(/([.!?]+)/); // keep punctuation as separate tokens
  const sentences = [];

  for (let i = 0; i < parts.length; i += 2) {
    const body = (parts[i] || '').trim();
    const punct = (parts[i + 1] || '').trim();

    if (!body) continue;
    const sentence = punct ? `${body}${punct}` : body;
    sentences.push(sentence);
  }

  return sentences;
}

/**
 * For a single whop's faqcontent, ensure that no sentence appears
 * more than once across all answers for that whop.
 *
 * - Case-insensitive
 * - Whitespace-normalised
 * - Rebuilds each answerHtml as <p>sentences_joined</p>
 */
function dedupeRepeatedSentencesWithinWhop(faqArray) {
  if (!Array.isArray(faqArray) || faqArray.length === 0) return faqArray;

  const seenSentences = new Set();

  return faqArray.map(faq => {
    if (!faq || typeof faq.answerHtml !== 'string') return faq;

    const originalHtml = faq.answerHtml;
    const text = stripHtml(originalHtml);
    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      // Nothing to dedupe, keep original
      return faq;
    }

    const kept = [];

    for (const s of sentences) {
      const key = s.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key) continue;

      if (seenSentences.has(key)) {
        // HARD RULE: never allow this sentence again in this whop
        continue;
      }

      seenSentences.add(key);
      kept.push(s);
    }

    // If nothing changed, keep original HTML
    const newText = kept.join(' ');
    const originalText = sentences.join(' ');
    if (newText === originalText) {
      return faq;
    }

    // Re-wrap into a simple paragraph
    const newHtml = `<p>${newText}</p>`;
    return { ...faq, answerHtml: newHtml };
  });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('='.repeat(60));
  console.log('FAQ SENTENCE DEDUPING – INTRA-WHOP');
  console.log('='.repeat(60));
  console.log(`Input JSONL:   ${INPUT_FILE}`);
  console.log(`Output JSONL:  ${OUTPUT_FILE}`);
  console.log('');

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  let total = 0;
  let entriesWithFaq = 0;
  let entriesChanged = 0;
  let totalFaqAnswers = 0;
  let totalSentencesRemoved = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      // Pass through invalid JSON as-is
      outputStream.write(line + '\n');
      continue;
    }

    total++;

    if (Array.isArray(entry.faqcontent) && entry.faqcontent.length > 0) {
      entriesWithFaq++;
      totalFaqAnswers += entry.faqcontent.length;

      const before = JSON.stringify(entry.faqcontent);

      // For reporting: count sentences before
      let beforeSentCount = 0;
      entry.faqcontent.forEach(f => {
        if (!f || typeof f.answerHtml !== 'string') return;
        beforeSentCount += splitIntoSentences(stripHtml(f.answerHtml)).length;
      });

      const deduped = dedupeRepeatedSentencesWithinWhop(entry.faqcontent);
      const after = JSON.stringify(deduped);

      if (before !== after) {
        entriesChanged++;
        // count after sentences to see how many we dropped
        let afterSentCount = 0;
        deduped.forEach(f => {
          if (!f || typeof f.answerHtml !== 'string') return;
          afterSentCount += splitIntoSentences(stripHtml(f.answerHtml)).length;
        });
        totalSentencesRemoved += Math.max(0, beforeSentCount - afterSentCount);
      }

      entry.faqcontent = deduped;
    }

    outputStream.write(JSON.stringify(entry) + '\n');

    if (total % 1000 === 0) {
      console.log(`Processed ${total} entries...`);
    }
  }

  outputStream.end();

  console.log('');
  console.log('DEDUPING COMPLETE');
  console.log('-----------------');
  console.log(`Total entries processed:      ${total}`);
  console.log(`Entries with faqcontent:      ${entriesWithFaq}`);
  console.log(`Entries with FAQ changes:     ${entriesChanged}`);
  console.log(`Total FAQ answers:            ${totalFaqAnswers}`);
  console.log(`Total sentences removed:      ${totalSentencesRemoved}`);
  console.log('');
  console.log('Guarantee: within each whop, no sentence (case-insensitive,');
  console.log('whitespace-normalised) appears more than once across all FAQ answers.');
  console.log('');
  console.log('Output written to: ' + OUTPUT_FILE);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
