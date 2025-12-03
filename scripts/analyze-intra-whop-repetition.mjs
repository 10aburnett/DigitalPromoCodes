#!/usr/bin/env node
/**
 * Analyzes repetition WITHIN individual whop entries
 * Finds phrases that repeat multiple times in the same JSON line
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/master/successes.jsonl';

// Extract phrases of 4-8 words
function extractPhrases(text, minWords = 4, maxWords = 8) {
  if (!text || typeof text !== 'string') return [];

  // Remove HTML tags
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');

  const phrases = [];
  for (let len = minWords; len <= maxWords; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ').toLowerCase();
      if (phrase.length > 15) { // Skip very short phrases
        phrases.push(phrase);
      }
    }
  }
  return phrases;
}

// Find repeated phrases within a single entry
function findIntraRepetition(obj) {
  const allText = [
    obj.aboutcontent,
    obj.termscontent,
    obj.howtoredeemcontent,
    obj.promodetailscontent,
  ].filter(Boolean).join(' ');

  // Also include FAQ answers
  if (Array.isArray(obj.faqcontent)) {
    for (const faq of obj.faqcontent) {
      if (faq.answerHtml) allText + ' ' + faq.answerHtml;
      if (faq.answer) allText + ' ' + faq.answer;
    }
  }

  const phrases = extractPhrases(allText);
  const phraseCounts = new Map();

  for (const phrase of phrases) {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  }

  // Find phrases appearing 2+ times
  const repeated = [];
  for (const [phrase, count] of phraseCounts) {
    if (count >= 2) {
      repeated.push({ phrase, count });
    }
  }

  return repeated.sort((a, b) => b.count - a.count);
}

function main() {
  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  console.log(`Analyzing ${lines.length} entries from ${INPUT_FILE}\n`);

  let entriesWithRepetition = 0;
  const globalRepeatCounts = new Map(); // Track which phrases repeat most often
  const examples = [];

  for (const line of lines) {
    const obj = JSON.parse(line);
    const repeated = findIntraRepetition(obj);

    if (repeated.length > 0) {
      entriesWithRepetition++;

      // Track globally
      for (const r of repeated) {
        const key = r.phrase.slice(0, 50);
        globalRepeatCounts.set(key, (globalRepeatCounts.get(key) || 0) + 1);
      }

      // Save example
      if (examples.length < 10) {
        examples.push({
          slug: obj.slug,
          repeated: repeated.slice(0, 3)
        });
      }
    }
  }

  console.log(`=== INTRA-WHOP REPETITION ANALYSIS ===\n`);
  console.log(`Entries with internal repetition: ${entriesWithRepetition} / ${lines.length}`);
  console.log(`Percentage: ${(entriesWithRepetition / lines.length * 100).toFixed(1)}%\n`);

  console.log(`=== MOST COMMONLY REPEATED PHRASES ===\n`);
  const sorted = [...globalRepeatCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [phrase, count] of sorted.slice(0, 20)) {
    console.log(`  ${count}x: "${phrase}..."`);
  }

  console.log(`\n=== EXAMPLE ENTRIES ===\n`);
  for (const ex of examples.slice(0, 5)) {
    console.log(`${ex.slug}:`);
    for (const r of ex.repeated) {
      console.log(`  ${r.count}x: "${r.phrase.slice(0, 60)}..."`);
    }
    console.log('');
  }
}

main();
