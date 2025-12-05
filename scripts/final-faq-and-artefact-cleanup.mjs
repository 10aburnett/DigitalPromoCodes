#!/usr/bin/env node

/**
 * FINAL PUBLISH-READY CLEANUP
 *
 * For each JSONL entry:
 *
 * 1) GLOBAL ARTEFACT FIXES (all main HTML fields + FAQ answers)
 *    - "the itduct page"  → "the product page"
 *    - "your it X"        → "your X" (e.g. "your it membership" → "your membership")
 *
 * 2) TRASH SENTENCE REMOVAL (aboutcontent + FAQ answers)
 *    - Sentence-level cleanup, using plain text:
 *        - atomic filler: "better results", "value", "offers ongoing support", "by use case"
 *        - short nonsense like "research shows, results", "simply put, results", etc.
 *        - any sentence containing "you'll get consistent value"
 *        - any sentence that contains BOTH:
 *             "better results"
 *           AND ("this helps" OR "this makes sure")
 *    - For aboutcontent:
 *        - operates at <p> paragraph level; each <p> is cleaned and rebuilt
 *    - For FAQ answers:
 *        - cleaned sentence-level, then de-duplicated across the whop
 *
 * 3) INTRA-WHOP FAQ SENTENCE DEDUPE
 *    - After trash removal, for each whop:
 *      * Split all FAQ answers into sentences
 *      * Case-insensitive, whitespace-normalised comparison
 *      * Ensure NO sentence appears more than once across ALL FAQ answers
 *      * Rebuild each answerHtml as <p>sentence1 sentence2 ...</p>
 *
 * 4) "BY USE CASE" DE-SPAMMING
 *    - For every cleaned HTML block (aboutcontent, promodetails, terms, FAQ answers):
 *      * Keep the first "by use case"
 *      * Remove subsequent "by use case" occurrences within that same field
 *      * Normalise resulting whitespace
 *
 * 5) Other fields
 *    - howtoredeemcontent / promodetailscontent / termscontent:
 *      * global artefact fixes ("itduct"/"your it")
 *      * "by use case" de-spam
 *      * (no structural rewrite, so <ul>/<li> etc are preserved)
 *
 * Usage:
 *   node scripts/final-faq-and-artefact-cleanup.mjs input.jsonl output.jsonl
 *
 * Defaults:
 *   input:  data/content/master/successes.jsonl
 *   output: data/content/master/successes-PUBLISH-READY.jsonl
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const INPUT_FILE =
  process.argv[2] || 'data/content/master/successes.jsonl';

const OUTPUT_FILE =
  process.argv[3] || 'data/content/master/successes-PUBLISH-READY.jsonl';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Split a plain-text string into sentences based on . ? !
 * Returns an array of sentence strings WITH punctuation preserved.
 */
function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') return [];

  const parts = text.split(/([.!?]+)/); // keep punctuation
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

function normalizeSentenceKey(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// GLOBAL ARTEFACT FIXES (all main fields + FAQ answers)
// ---------------------------------------------------------------------------

/**
 * Fix cross-cutting artefacts in ANY HTML string:
 *  - "the itduct page" → "the product page"
 *  - "your it X"       → "your X" (up to 3 words for X)
 */
function fixGlobalArtefacts(html) {
  if (!html || typeof html !== 'string') return html;

  let out = html;

  // 1) Fix "the itduct page" typo
  out = out.replace(/\bthe itduct page\b/gi, 'the product page');

  // 2) Generic "your it X" → "your X"
  //    Example: "your it membership" → "your membership"
  //    Allow 1–3 words for X to catch things like "your it trading journey"
  out = out.replace(
    /\byour it ([a-z]+(?:\s+[a-z]+){0,2})\b/gi,
    'your $1'
  );

  return out;
}

// ---------------------------------------------------------------------------
// FAQ / ABOUT TRASH SENTENCE RULES
// ---------------------------------------------------------------------------
//
// These are the remaining "trash" patterns we want to remove from FAQ answers
// and aboutcontent. They are clearly nonsensical padding / AI artefacts.
//

// Atomic sentences we nuke if they stand alone
const ATOMIC_TRASH_SENTENCE_KEYS = new Set(
  [
    // Simple filler
    'better results',
    'value',
    'offers ongoing support',
    'by use case',

    // Short "X, results" garbage
    'research shows, results',
    'basically, results',
    'simply put, results',
    'together, results',
    'you get, results',
    "you're not, results",
    'experience demonstrates, results',
    'beyond that, results',
    'additionally, results',
    'this means, results'
  ].map(s => normalizeSentenceKey(s))
);

// Phrases we also treat as trashy when part of a sentence
const TRASH_TAIL_BASES = [
  "more importantly, you'll get consistent value",
  'this makes sure better results',
  'this helps guarantee better results',
  'this helps confirm better results',
  'this helps ensure better results',
  'the benefit is, this makes sure better results',
  'this helps you, this makes sure better results'
];

/**
 * Decide if a sentence (plain text) is trash according to our rules.
 *
 * Rules:
 *   - Drop any sentence whose normalised text is in ATOMIC_TRASH_SENTENCE_KEYS
 *   - Drop any sentence containing "you'll get consistent value"
 *   - Drop any sentence that contains BOTH:
 *       * "better results"
 *       * AND ("this helps" OR "this makes sure")
 */
function isTrashSentence(sentence) {
  const key = normalizeSentenceKey(sentence);
  if (!key) return false;

  // 1) Pure atomic trash (short fillers)
  if (ATOMIC_TRASH_SENTENCE_KEYS.has(key)) {
    return true;
  }

  const lower = key.toLowerCase();

  // 2) "you'll get consistent value" filler
  if (lower.includes("you'll get consistent value")) {
    return true;
  }

  // 3) "this helps/makes sure ... better results" family
  if (
    lower.includes('better results') &&
    (lower.includes('this helps') || lower.includes('this makes sure'))
  ) {
    return true;
  }

  // 4) Any sentence that *contains* one of the TRASH_TAIL_BASES verbatim
  for (const base of TRASH_TAIL_BASES) {
    if (lower.includes(base.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Given plain text, remove trash sentences and optionally de-duplicate
 * sentences within this single field.
 *
 * Returns { text: cleanedText, removedCount }
 */
function cleanTextSentences(text, { dedupeWithinField = false } = {}) {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    return { text, removedCount: 0 };
  }

  const kept = [];
  const seen = new Set();
  let removed = 0;

  for (const s of sentences) {
    if (!s) continue;

    // Trash?
    if (isTrashSentence(s)) {
      removed++;
      continue;
    }

    const key = normalizeSentenceKey(s);
    if (!key) continue;

    if (dedupeWithinField && seen.has(key)) {
      // Remove duplicate sentence within this field
      removed++;
      continue;
    }

    seen.add(key);
    kept.push(s);
  }

  if (kept.length === 0) {
    // Fail-safe: if everything would be removed, keep the original text
    return { text, removedCount: 0 };
  }

  return { text: kept.join(' '), removedCount: removed };
}

/**
 * Reduce "by use case" repetition within a single HTML block:
 *  - Keep first occurrence
 *  - Remove subsequent ones
 *  - Normalise spaces afterwards
 */
function reduceByUseCaseRepetition(html) {
  if (!html || typeof html !== 'string') return html;

  let count = 0;
  const out = html.replace(/by use case/gi, match => {
    count++;
    return count === 1 ? match : '';
  });

  return out.replace(/\s{2,}/g, ' ');
}

// ---------------------------------------------------------------------------
// FIELD-SPECIFIC CLEANERS
// ---------------------------------------------------------------------------

/**
 * Clean a <p>-based HTML field (e.g. aboutcontent):
 *   - Fix artefacts
 *   - For each <p>…</p>:
 *       * sentence-level trash removal
 *       * optional dedupe within this field
 *       * rebuild that paragraph
 *   - If no <p> present, treat entire HTML as one text block and wrap as a single <p>…</p>
 *   - De-spam "by use case" within this field
 */
function cleanParagraphField(html, { dedupeWithinField = false } = {}, stats) {
  if (!html || typeof html !== 'string') return html;

  let out = fixGlobalArtefacts(html);
  let hadParagraphs = false;
  let totalRemoved = 0;

  out = out.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, match => {
    hadParagraphs = true;
    const innerHtml = match.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');
    const text = stripHtml(innerHtml);
    const { text: cleanedText, removedCount } = cleanTextSentences(text, {
      dedupeWithinField
    });

    totalRemoved += removedCount;

    if (!cleanedText) {
      // Paragraph became empty; drop it entirely
      return '';
    }

    return `<p>${cleanedText}</p>`;
  });

  if (!hadParagraphs) {
    // No explicit <p>; treat whole thing as one block
    const text = stripHtml(out);
    const { text: cleanedText, removedCount } = cleanTextSentences(text, {
      dedupeWithinField
    });

    totalRemoved += removedCount;

    if (!cleanedText) {
      // Leave original if we'd nuke everything
      return out;
    }

    out = `<p>${cleanedText}</p>`;
  }

  out = reduceByUseCaseRepetition(out);

  if (stats) {
    stats.sentencesRemoved += totalRemoved;
  }

  return out;
}

/**
 * Clean a FAQ answerHtml:
 *   1) Global artefact fixes
 *   2) Sentence-level trash removal
 *   3) Rewrap kept sentences as <p>…</p>
 */
function cleanupFaqAnswerHtml(html, stats) {
  if (!html || typeof html !== 'string') return html;

  let out = fixGlobalArtefacts(html);

  const text = stripHtml(out);
  const { text: cleanedText, removedCount } = cleanTextSentences(text, {
    dedupeWithinField: false
  });

  if (stats) {
    stats.sentencesRemoved += removedCount;
  }

  if (!cleanedText) {
    // Fail-safe: keep artefact-fixed original if everything would go
    return out;
  }

  out = `<p>${cleanedText}</p>`;
  out = reduceByUseCaseRepetition(out);
  return out;
}

/**
 * For a single whop's faqcontent, ensure that:
 *   - All answers are cleaned (trash removed, artefacts fixed)
 *   - NO sentence appears more than once across ALL answers
 *
 * After trash removal, we:
 *   - Split answers into sentences
 *   - Maintain a Set of seen sentences for this whop
 *   - Remove duplicates
 *   - Rebuild each answer as a single <p>…</p> from kept sentences
 */
function processFaqContentForWhop(faqArray, stats) {
  if (!Array.isArray(faqArray) || faqArray.length === 0) return faqArray;

  const seenSentences = new Set();

  return faqArray.map(faq => {
    if (!faq || typeof faq.answerHtml !== 'string') return faq;

    // First, clean this answer (artefacts + trash + by-use-case)
    const cleanedHtml = cleanupFaqAnswerHtml(faq.answerHtml, stats);
    const text = stripHtml(cleanedHtml);
    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      // Nothing to dedupe, but keep cleanedHtml (artefact fixes may still matter)
      return { ...faq, answerHtml: cleanedHtml };
    }

    const kept = [];

    for (const s of sentences) {
      const key = normalizeSentenceKey(s);
      if (!key) continue;

      if (seenSentences.has(key)) {
        // HARD RULE: never allow this sentence again in this whop
        if (stats) stats.sentencesRemoved += 1;
        continue;
      }

      seenSentences.add(key);
      kept.push(s);
    }

    const newText = kept.join(' ');
    const originalTextAfterCleanup = sentences.join(' ');

    if (newText === originalTextAfterCleanup) {
      // No dedupe-based change, keep cleanedHtml as-is
      return { ...faq, answerHtml: cleanedHtml };
    }

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

  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('='.repeat(60));
  console.log('FINAL FAQ + ARTEFACT CLEANUP (PUBLISH-READY)');
  console.log('='.repeat(60));
  console.log(`Input JSONL:   ${INPUT_FILE}`);
  console.log(`Output JSONL:  ${OUTPUT_FILE}`);
  console.log('');

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  let total = 0;
  let entriesWithFaq = 0;
  let entriesChanged = 0;
  let totalFaqAnswers = 0;
  let totalSentencesRemoved = 0;
  let totalArtefactFixes = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      // Pass through invalid JSON as-is
      outputStream.write(line + '\n');
      continue;
    }

    total++;

    const processed = { ...entry };

    // Stats bucket for this entry
    const entryStats = { sentencesRemoved: 0 };
    let entryArtefactFixes = 0;

    // 1) Apply global + sentence-level fixes to aboutcontent
    if (processed.aboutcontent) {
      const before = processed.aboutcontent;
      const after = cleanParagraphField(
        processed.aboutcontent,
        { dedupeWithinField: true },
        entryStats
      );
      processed.aboutcontent = after;
      if (before !== after) {
        entriesChanged++;
        entryArtefactFixes++;
      }
    }

    // 2) Global artefact + by-use-case cleanup on other main HTML fields
    const otherHtmlFields = [
      'howtoredeemcontent',
      'promodetailscontent',
      'termscontent'
    ];

    otherHtmlFields.forEach(field => {
      if (processed[field]) {
        const before = processed[field];
        let out = fixGlobalArtefacts(before);
        out = reduceByUseCaseRepetition(out);
        processed[field] = out;
        if (before !== out) {
          entriesChanged++;
          entryArtefactFixes++;
        }
      }
    });

    // 3) FAQ cleanup + dedupe across answers
    const faqs = Array.isArray(processed.faqcontent)
      ? processed.faqcontent
      : null;

    if (faqs && faqs.length > 0) {
      entriesWithFaq++;
      totalFaqAnswers += faqs.length;

      const beforeJson = JSON.stringify(faqs);

      const deduped = processFaqContentForWhop(faqs, entryStats);

      const afterJson = JSON.stringify(deduped);

      if (beforeJson !== afterJson) {
        entriesChanged++;
      }

      processed.faqcontent = deduped;
    }

    totalSentencesRemoved += entryStats.sentencesRemoved;
    totalArtefactFixes += entryArtefactFixes;

    outputStream.write(JSON.stringify(processed) + '\n');

    if (total % 1000 === 0) {
      console.log(`Processed ${total} entries...`);
    }
  }

  outputStream.end();

  console.log('');
  console.log('CLEANUP COMPLETE');
  console.log('----------------');
  console.log(`Total entries processed:         ${total}`);
  console.log(`Entries with faqcontent:         ${entriesWithFaq}`);
  console.log(`Entries with any changes:        ${entriesChanged}`);
  console.log(`Total FAQ answers:               ${totalFaqAnswers}`);
  console.log(`Sentences removed (trash/dupes): ${totalSentencesRemoved}`);
  console.log(`Global artefact fixes applied:   ${totalArtefactFixes}`);
  console.log('');
  console.log('Guarantees:');
  console.log('  - Within each whop, NO FAQ sentence (case-insensitive,');
  console.log('    whitespace-normalised) appears more than once across FAQ answers.');
  console.log('  - The ugly "better results / value / offers ongoing support / by use case"');
  console.log('    atomic fillers, "you\'ll get consistent value", and');
  console.log('    "this helps/makes sure ... better results" sentences are removed');
  console.log('    wherever they appear as standalone sentences in FAQs/about.');
  console.log('  - "the itduct page" and "your it X" artefacts are normalised safely');
  console.log('    across the main content fields as well as FAQs.');
  console.log('');
  console.log('Output written to: ' + OUTPUT_FILE);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
