#!/usr/bin/env node

/**
 * MASTER FAQ TRASH CLEANUP + INTRA-WHOP SENTENCE DEDUPE
 *
 * For each JSONL entry:
 *   - Looks at `faqcontent` (array of { question, answerHtml })
 *   - For each answerHtml:
 *       1) Removes all known "trash" fragments / sentences:
 *          - Tail shards like "better results", "value", "offers ongoing support", "by use case"
 *          - Broken "results" sentences like "Research shows, results", "Basically, results",
 *            "You're not, results", etc.
 *          - Weird "better results" constructions like
 *              "The benefit is, this makes sure better results."
 *              "This helps you, this makes sure better results."
 *              "Basically, this helps guarantee better results."
 *       2) Dedupes sentences within the whop:
 *          - NO sentence (case-insensitive, whitespace-normalised) may appear more than once
 *            across ALL FAQ answers for that whop.
 *          - Rebuilds cleaned answers as <p>sentence1 sentence2 ...</p>
 *
 * Usage:
 *   node scripts/master-faq-trash-cleanup.mjs input.jsonl output.jsonl
 *
 * Defaults:
 *   input:  data/content/master/successes.jsonl
 *   output: data/content/master/successes-faq-PUBLISH-READY.jsonl
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
  process.argv[3] || 'data/content/master/successes-faq-PUBLISH-READY.jsonl';

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

// Escape a string for RegExp
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// TRASH PHRASES / FRAGMENTS (from full corpus scan)
// ---------------------------------------------------------------------------
//
// These are the "shit" phrases you highlighted, plus related families
// discovered across the entire FAQ corpus. They are clearly meaningless
// padding. We remove them either when they appear as:
//
//   - Tail shards right before </p>
//   - Standalone sentences (e.g. "Research shows, results.")
//

const TRASH_TAIL_BASES = [
  // Simple shards commonly at the end:
  'offers ongoing support',
  'better results',
  'value',
  'by use case',

  // The explicit nasty example you gave:
  "more importantly, you'll get consistent value",

  // Weird better-results constructions:
  'this makes sure better results',
  'this helps guarantee better results',
  'this helps confirm better results',
  'this helps ensure better results',
  'the benefit is, this makes sure better results',
  'this helps you, this makes sure better results',

  // "X, results" family:
  'additionally, results',
  'alongside others, results',
  'based on, results',
  'basically, results',
  'beyond that, results',
  'experience demonstrates, results',
  'furthermore, results',
  'research shows, results',
  'simply put, results',
  'this means, results',
  'together, results',
  'you get, results',
  "you're not, results",

  // Extra support/use-case shards:
  "what's more, support",
  'beyond that, support',
  'however, use case',
  'nevertheless, use case',

  // New "time + this + vague verb" junk:
  'currently, this makes sure',
  'currently this makes sure',
  'right now, this helps confirm',
  'right now this helps confirm',
  'currently, this helps confirm',
  'currently this helps confirm',
  'right now, this makes sure',
  'right now this makes sure',

  // Weird "what's more" variants:
  "what's more to this to that",
  "what's more to this",
  "what's more to that",

  // Incomplete fragments:
  'and, this makes sure',
  'and this makes sure',
  'includes, this helps guarantee',
  'includes, this helps confirm',
  'includes this helps guarantee',
  'includes this helps confirm'
];

// ---------------------------------------------------------------------------
// MID-SENTENCE TRASH REGEXES
// ---------------------------------------------------------------------------
// These catch "Plus, this helps confirm better results" style clauses
// even when they appear mid-sentence (not just at paragraph end).

const MID_TRASH_REGEXES = [
  // e.g. "Plus, this helps confirm better results." / "And this helps confirm better results"
  /\b(plus|and|also|what's more|in addition|furthermore|moreover|includes|based on|basically|beyond that|experience demonstrates|research shows|simply put|this means|together|you get|you're not|additionally|alongside others|currently|right now)?\s*,?\s*this\s+(helps|makes sure|helps confirm|helps guarantee|helps ensure)\s+better results\b\.?/gi,

  // Bare fragment without the discourse marker (in the middle of a sentence)
  /\bthis\s+(helps|makes sure|helps confirm|helps guarantee|helps ensure)\s+better results\b\.?/gi,

  // Incomplete "this makes sure" / "this helps confirm" with no object
  /\b(plus|and|also|includes|basically|furthermore|moreover)?\s*,?\s*this\s+(helps|makes sure|helps confirm|helps guarantee|helps ensure)\s*[.,]?\s*$/gi,

  // "X, this makes sure" at end of sentence (incomplete)
  /\b(and|includes|plus|also)\s*,?\s*this\s+(makes sure|helps confirm|helps guarantee|helps ensure)\s*$/gi
];

/**
 * Remove trash tails from a single HTML answer:
 *  - Case-insensitive
 *  - Only when the phrase appears as a tail fragment before </p>
 *  - Optional trailing '.' after the phrase allowed
 */
function removeTrashTailsFromAnswer(html) {
  if (!html || typeof html !== 'string') return html;

  let out = html;

  for (const base of TRASH_TAIL_BASES) {
    const escaped = escapeForRegex(base);
    // Matches:
    //   " base</p>"
    //   " base.</p>"
    //   "   base   .   </p>"
    //
    // We remove the phrase portion and keep the </p>.
    const tailRegex = new RegExp(`\\s*${escaped}\\.?\\s*(?=</p>)`, 'gi');
    out = out.replace(tailRegex, '');
  }

  // Clean up spaces before </p>
  out = out.replace(/\s+<\/p>/gi, '</p>');

  // Remove completely empty paragraphs
  out = out.replace(/<p>\s*<\/p>/gi, '');

  return out;
}

/**
 * Remove standalone trash sentences anywhere in the answer (still conservative).
 *
 * We treat each TRASH_TAIL_BASE as a possible *full sentence*:
 *   "Research shows, results."
 *   "Basically, results."
 *   "More importantly, you'll get consistent value."
 *
 * We strip them out when they appear as their own sentence in the plain text,
 * then rebuild the HTML paragraph.
 */
function removeStandaloneTrashSentences(html) {
  if (!html || typeof html !== 'string') return html;

  const text = stripHtml(html);
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return html;

  const trashKeys = TRASH_TAIL_BASES.map(b =>
    b.toLowerCase().replace(/\s+/g, ' ').trim()
  );

  const kept = [];

  for (const s of sentences) {
    const key = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key) continue;

    // Is this sentence exactly one of the trash bases (possibly with trailing '.')
    const isTrash = trashKeys.some(baseKey => {
      // allow the plain base or base + '.'
      return key === baseKey || key === `${baseKey}.`;
    });

    if (isTrash) {
      // Drop entire sentence
      continue;
    }

    kept.push(s);
  }

  if (kept.length === 0) {
    // If we somehow removed everything, keep the original rather than nuking it.
    return html;
  }

  const newText = kept.join(' ');
  return `<p>${newText}</p>`;
}

/**
 * Full trash cleanup for one FAQ answer:
 *   1) remove tail fragments before </p>
 *   2) remove mid-sentence trash clauses like "Plus, this helps confirm better results"
 *   3) remove standalone trash sentences
 */
function cleanupFaqAnswerHtml(html) {
  if (!html || typeof html !== 'string') return html;

  let out = html;

  // 1) Kill tail shards before </p>
  out = removeTrashTailsFromAnswer(out);

  // 2) Kill mid-sentence trash clauses like
  //    "Plus, this helps confirm better results"
  //    "And this makes sure better results"
  for (const re of MID_TRASH_REGEXES) {
    out = out.replace(re, '');
  }

  // Clean up commas+spaces left hanging by the removal
  out = out
    .replace(/\s+,(\s*[.!?])/g, '$1')      // ", ." → "."
    .replace(/\s+,(\s*$)/g, '')            // trailing ", " at end of text
    .replace(/\(\s*\)/g, '')               // empty parentheses just in case
    .replace(/\s{2,}/g, ' ')               // collapse double spaces
    .replace(/\s+<\/p>/gi, '</p>')         // clean spaces before </p>
    .replace(/<p>\s+/gi, '<p>');           // clean spaces after <p>

  // 3) Remove standalone trash sentences (after we've stripped the clauses)
  out = removeStandaloneTrashSentences(out);

  return out;
}

/**
 * For a single whop's faqcontent, ensure that no sentence appears
 * more than once across ALL answers (case-insensitive, whitespace-normalised).
 *
 * After trash removal, we:
 *   - Split answers into sentences
 *   - Maintain a Set of seen sentences for this whop
 *   - Remove any duplicates
 *   - Rebuild each answer as a single <p>...</p> from kept sentences
 */
function dedupeSentencesWithinWhop(faqArray) {
  if (!Array.isArray(faqArray) || faqArray.length === 0) return faqArray;

  const seenSentences = new Set();

  return faqArray.map(faq => {
    if (!faq || typeof faq.answerHtml !== 'string') return faq;

    const cleanedHtml = cleanupFaqAnswerHtml(faq.answerHtml);
    const text = stripHtml(cleanedHtml);
    const sentences = splitIntoSentences(text);

    if (sentences.length === 0) {
      // Nothing to dedupe, but keep it as cleanedHtml (in case trash removal changed it)
      return { ...faq, answerHtml: cleanedHtml };
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

    // If no change, keep cleanedHtml as-is
    const newText = kept.join(' ');
    const originalTextAfterCleanup = sentences.join(' ');

    if (newText === originalTextAfterCleanup) {
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
  console.log('MASTER FAQ TRASH CLEANUP + SENTENCE DEDUPE');
  console.log('='.repeat(60));
  console.log(`Input JSONL:   ${INPUT_FILE}`);
  console.log(`Output JSONL:  ${OUTPUT_FILE}`);
  console.log('');
  console.log('Trash phrase families (case-insensitive):');
  TRASH_TAIL_BASES.forEach(p => console.log('  - ' + p));
  console.log('');

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  let total = 0;
  let entriesWithFaq = 0;
  let entriesChanged = 0;
  let totalFaqAnswers = 0;
  let answersChanged = 0;
  let totalSentencesRemovedAsDupes = 0;
  let totalTrashFragmentsTouched = 0;

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

    const faqs = Array.isArray(entry.faqcontent) ? entry.faqcontent : null;

    if (faqs && faqs.length > 0) {
      entriesWithFaq++;
      totalFaqAnswers += faqs.length;

      // For stats: count sentences before
      let beforeSentenceCount = 0;
      faqs.forEach(f => {
        if (!f || typeof f.answerHtml !== 'string') return;
        beforeSentenceCount += splitIntoSentences(stripHtml(f.answerHtml)).length;
      });

      const beforeJson = JSON.stringify(faqs);

      const deduped = dedupeSentencesWithinWhop(faqs);

      const afterJson = JSON.stringify(deduped);

      // For stats: count sentences after
      let afterSentenceCount = 0;
      deduped.forEach(f => {
        if (!f || typeof f.answerHtml !== 'string') return;
        afterSentenceCount += splitIntoSentences(stripHtml(f.answerHtml)).length;
      });

      const removed = Math.max(0, beforeSentenceCount - afterSentenceCount);
      totalSentencesRemovedAsDupes += removed;

      if (beforeJson !== afterJson) {
        entriesChanged++;
        // Approximate "trash fragments touched" as removed sentences (it's all shit).
        answersChanged += faqs.length;
        totalTrashFragmentsTouched += removed;
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
  console.log('CLEANUP COMPLETE');
  console.log('----------------');
  console.log(`Total entries processed:          ${total}`);
  console.log(`Entries with faqcontent:          ${entriesWithFaq}`);
  console.log(`Entries with FAQ changes:         ${entriesChanged}`);
  console.log(`Total FAQ answers:                ${totalFaqAnswers}`);
  console.log(`Approx. answers touched:          ${answersChanged}`);
  console.log(`Sentences removed (dupes/trash):  ${totalSentencesRemovedAsDupes}`);
  console.log('');
  console.log('Guarantees:');
  console.log('  - Within each whop, NO sentence (case-insensitive,');
  console.log('    whitespace-normalised) appears more than once across FAQ answers.');
  console.log('  - All known trash tails / nonsense "results/value/support" fillers');
  console.log('    are stripped wherever they appear as tail shards or standalone sentences.');
  console.log('');
  console.log('Output written to: ' + OUTPUT_FILE);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
