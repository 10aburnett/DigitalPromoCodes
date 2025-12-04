#!/usr/bin/env node
/**
 * MASTER FINAL CLEANUP + SIMILARITY AUDIT
 *
 * Steps (per entry):
 *  1) Apply conservative grammar fixes (meaning-preserving)
 *     - Fix "the it", "the this", "this this", "the the", etc.
 *     - Remove standalone stray "s" tokens (SAFELY - preserves possessives)
 *     - Fix spacing / punctuation artefacts
 *  2) Apply the same grammar fixes to FAQ answers
 *  3) Deduplicate repeated boilerplate FAQ sentences WITHIN each whop
 *     - Keep each boilerplate sentence at most once per whop
 *     - Do not shorten answers below a minimum length
 *
 * Global:
 *  4) Write cleaned entries to OUTPUT JSONL
 *  5) Run a similarity SAMPLE audit on main content:
 *     - Main content = aboutcontent + promodetailscontent + FAQ answers
 *     - Compute cosine similarity + ROUGE-L on sampled pairs
 *     - Emit JSON report with metrics + top similar pairs
 *
 * Output:
 *  - Publish-ready JSONL
 *  - analysis/master-similarity-final-report.json
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';

// ============================================================================
// CONFIG
// ============================================================================

// Default input: your best current file (adjust if needed)
const INPUT_FILE =
  process.argv[2] || 'data/content/master/successes-final-with-openers.jsonl';

// Default output: publish-ready file
const OUTPUT_FILE =
  process.argv[3] || 'data/content/master/successes-PUBLISH-READY.jsonl';

// Similarity report
const SIMILARITY_REPORT_FILE =
  'analysis/master-similarity-final-report.json';

// Minimum FAQ answer length (plain text) after dedupe
const MIN_ANSWER_LENGTH = 80;

// Similarity thresholds for reporting
const SIM_THRESHOLDS = {
  maxRougeL: 0.70,
  maxCosine: 0.85
};

// Limit on number of pairs to sample for similarity
const MAX_PAIRS_TO_SAMPLE = 5000;

// ============================================================================
// TEXT UTILS
// ============================================================================

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// ============================================================================
// GRAMMAR FIXES (CONSERVATIVE + SAFE "s" CLEANUP)
// ============================================================================

const GRAMMAR_FIXES = [
  // --- Fix "the it" type patterns with neutral replacements ---
  { pattern: /\bThe it provides\b/g, replacement: 'This provides' },
  { pattern: /\bThe it offers\b/g, replacement: 'This offers' },
  { pattern: /\bThe it includes\b/g, replacement: 'This includes' },
  { pattern: /\bThe it gives\b/g, replacement: 'This gives' },
  { pattern: /\bThe it helps\b/g, replacement: 'This helps' },
  { pattern: /\bThe it is\b/g, replacement: 'This is' },
  { pattern: /\bThe it has\b/g, replacement: 'This has' },
  { pattern: /\bthe it\b/gi, replacement: 'this' },

  // --- "this it" patterns ---
  { pattern: /\bthis it\b/gi, replacement: 'this' },
  { pattern: /\bThis it\b/g, replacement: 'This' },

  // --- "the this" patterns ---
  { pattern: /\bthe this\b/gi, replacement: 'this' },
  { pattern: /\bThe this\b/g, replacement: 'This' },
  { pattern: /\butilizing the this\b/gi, replacement: 'utilizing this' },
  { pattern: /\bUsing the this\b/g, replacement: 'Using this' },

  // --- Double word patterns ---
  { pattern: /\bthis this\b/gi, replacement: 'this' },
  { pattern: /\bThis this\b/g, replacement: 'This' },
  { pattern: /\bthe the\b/gi, replacement: 'the' },
  { pattern: /\bThe the\b/g, replacement: 'The' },
  { pattern: /\ba a\b/gi, replacement: 'a' },
  { pattern: /\ban an\b/gi, replacement: 'an' },
  { pattern: /\ba an\b/gi, replacement: 'an' },
  { pattern: /\ban a\b/gi, replacement: 'a' },

  // --- Community placeholder issues (conservative) ---
  { pattern: /\bthe this community\b/gi, replacement: 'this community' },
  { pattern: /\bThe this community\b/g, replacement: 'This community' },
  { pattern: /\butilizing the this community\b/gi, replacement: 'utilizing this community' },
  { pattern: /\bon this community\b/gi, replacement: 'in this community' },
  { pattern: /\bsave on this community services\b/gi, replacement: 'save on community services' },
  { pattern: /\bsave in this community services\b/gi, replacement: 'save on community services' },

  // --- Awkward "your it" patterns (remove broken "it") ---
  { pattern: /\benhance your it experience\b/gi, replacement: 'enhance your experience' },
  { pattern: /\bimprove your it experience\b/gi, replacement: 'improve your experience' },
  { pattern: /\byour it experience\b/gi, replacement: 'your experience' },
  { pattern: /\byour it journey\b/gi, replacement: 'your journey' },
  { pattern: /\byour it subscription\b/gi, replacement: 'your subscription' },
  { pattern: /\byour it membership\b/gi, replacement: 'your membership' },
  { pattern: /\byour it access\b/gi, replacement: 'your access' },

  // --- Double opportunity/chance artefacts from phrase replacement ---
  { pattern: /\bthis opportunity for this opportunity\b/gi, replacement: 'this opportunity' },
  { pattern: /\bthis chance for this chance\b/gi, replacement: 'this chance' },
  { pattern: /\bGrab this opportunity for this opportunity\b/gi, replacement: 'Grab this opportunity' },
  { pattern: /\bSeize this chance for this chance\b/gi, replacement: 'Seize this chance' },
  { pattern: /\bHere's your chance for this opportunity\b/gi, replacement: "Here's your chance" },
  { pattern: /\bTake advantage of this opportunity for this opportunity\b/gi, replacement: 'Take advantage of this opportunity' },

  // --- Standalone stray "s" cleanup (SAFE - preserves possessives like Alex's, it's) ---
  // We ONLY target cases where "s" is clearly dangling, not part of a word.

  // 1) " s " with surrounding whitespace (true stand-alone token)
  { pattern: /(\s)s(\s)/g, replacement: '$1$2' },

  // 2) " s" before punctuation like "s." or "s," but only if preceded by space
  { pattern: /(\s)s([.,!?])(\s|$)/g, replacement: '$1$2$3' },

  // 3) "s" inside brackets/commas like "( s )" or ", s ,"
  { pattern: /([(\[,])\s+s\s*([)\],])/g, replacement: '$1$2' },

  // 4) "using s", "with s", "and s", "or s", "to s" → just drop the "s"
  { pattern: /(using|leveraging|with|and|or|to)\s+s(\s)/gi, replacement: '$1$2' },

  // --- Spacing and punctuation cleanup (text only) ---
  { pattern: /([a-zA-Z0-9])\s+,/g, replacement: '$1,' },
  { pattern: /([a-zA-Z0-9])\s+\./g, replacement: '$1.' },
  { pattern: /([a-zA-Z0-9])\s+!/g, replacement: '$1!' },
  { pattern: /([a-zA-Z0-9])\s+\?/g, replacement: '$1?' },

  // Multiple spaces → single
  { pattern: / {2,}/g, replacement: ' ' },

  // Missing space after sentence-ending punctuation before capital letter
  { pattern: /\.([A-Z][a-z])/g, replacement: '. $1' },
  { pattern: /!([A-Z][a-z])/g, replacement: '! $1' },
  { pattern: /\?([A-Z][a-z])/g, replacement: '? $1' }
];

function applyGrammarFixes(text) {
  if (!text || typeof text !== 'string') return { text, fixCount: 0 };

  let fixed = text;
  let totalFixes = 0;

  for (const { pattern, replacement } of GRAMMAR_FIXES) {
    const matches = fixed.match(pattern);
    if (matches) {
      totalFixes += matches.length;
      fixed = fixed.replace(pattern, replacement);
    }
  }

  return { text: fixed, fixCount: totalFixes };
}

// ============================================================================
// FAQ BOILERPLATE DEDUPE (INTRA-WHOP)
// ============================================================================

// Overused FAQ boilerplate sentences to dedupe WITHIN the same whop.
// You can extend this list over time as you discover more.
const FAQ_BOILERPLATE_SENTENCES = [
  "Results and eligibility can vary, so review the latest details on the product page. If you are unsure, compare tiers side by side before choosing the option you prefer.",
  "Results and eligibility can vary, so review the latest details on the product page.",
  "If you are unsure, compare tiers side by side before choosing the option you prefer."
];

function removeBoilerplateOncePerWhop(faqArray) {
  if (!Array.isArray(faqArray) || faqArray.length === 0) return faqArray;

  const seenBoilerplate = new Set();

  return faqArray.map(faq => {
    if (!faq || typeof faq.answerHtml !== 'string') return faq;

    let html = faq.answerHtml;
    const originalLen = stripHtml(html).length;

    FAQ_BOILERPLATE_SENTENCES.forEach(sentence => {
      if (!sentence) return;

      if (seenBoilerplate.has(sentence)) {
        // Already seen in this whop – try to remove it here
        if (html.includes(sentence)) {
          const without = html.replace(sentence, '').replace(/\s+\./g, '.').trim();
          const newLen = stripHtml(without).length;

          // Only remove if we don't make the answer too short
          if (newLen >= MIN_ANSWER_LENGTH) {
            html = without;
          }
        }
      } else {
        // First usage in this whop – keep it and mark as seen
        if (html.includes(sentence)) {
          seenBoilerplate.add(sentence);
        }
      }
    });

    return { ...faq, answerHtml: html };
  });
}

// ============================================================================
// SIMILARITY FUNCTIONS (COSINE + ROUGE-L)
// ============================================================================

function cosineSimilarity(text1, text2) {
  const tokens1 = tokenize(stripHtml(text1));
  const tokens2 = tokenize(stripHtml(text2));

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const freq1 = {};
  const freq2 = {};

  for (const t of tokens1) freq1[t] = (freq1[t] || 0) + 1;
  for (const t of tokens2) freq2[t] = (freq2[t] || 0) + 1;

  const allTokens = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const token of allTokens) {
    const f1 = freq1[token] || 0;
    const f2 = freq2[token] || 0;
    dotProduct += f1 * f2;
    norm1 += f1 * f1;
    norm2 += f2 * f2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Simple ROUGE-L (LCS-based)
function lcsLength(arr1, arr2) {
  const m = arr1.length;
  const n = arr2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function rougeLScore(text1, text2) {
  const tokens1 = tokenize(stripHtml(text1));
  const tokens2 = tokenize(stripHtml(text2));

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const lcs = lcsLength(tokens1, tokens2);
  const precision = lcs / tokens2.length;
  const recall = lcs / tokens1.length;

  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  // Ensure analysis dir exists
  const analysisDir = path.dirname(SIMILARITY_REPORT_FILE);
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }

  console.log('='.repeat(60));
  console.log('MASTER FINAL CLEANUP + SIMILARITY AUDIT');
  console.log('='.repeat(60));
  console.log(`Input JSONL:   ${INPUT_FILE}`);
  console.log(`Output JSONL:  ${OUTPUT_FILE}`);
  console.log(`Report JSON:   ${SIMILARITY_REPORT_FILE}`);
  console.log('');

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  const entriesForSimilarity = [];

  let total = 0;
  let totalGrammarFixes = 0;
  let entriesWithGrammarFixes = 0;
  let entriesWithFaqChanges = 0;
  let totalFaqAnswers = 0;
  let faqAnswersTouched = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch (err) {
      outputStream.write(line + '\n');
      continue;
    }

    total++;

    let entryFixes = 0;
    const processed = { ...entry };

    // Apply grammar fixes to main HTML fields
    const htmlFields = [
      'aboutcontent',
      'howtoredeemcontent',
      'promodetailscontent',
      'termscontent'
    ];

    htmlFields.forEach(field => {
      if (processed[field]) {
        const { text, fixCount } = applyGrammarFixes(processed[field]);
        processed[field] = text;
        entryFixes += fixCount;
      }
    });

    // Apply grammar fixes + FAQ dedupe
    if (processed.faqcontent && Array.isArray(processed.faqcontent)) {
      totalFaqAnswers += processed.faqcontent.length;

      // Grammar fixes on each FAQ answer
      const faqAfterGrammar = processed.faqcontent.map(faq => {
        if (!faq || typeof faq.answerHtml !== 'string') return faq;
        const { text, fixCount } = applyGrammarFixes(faq.answerHtml);
        entryFixes += fixCount;
        if (fixCount > 0) faqAnswersTouched++;
        return { ...faq, answerHtml: text };
      });

      const beforeFaqJson = JSON.stringify(faqAfterGrammar);
      const dedupedFaq = removeBoilerplateOncePerWhop(faqAfterGrammar);
      const afterFaqJson = JSON.stringify(dedupedFaq);

      if (beforeFaqJson !== afterFaqJson) {
        entriesWithFaqChanges++;
      }

      processed.faqcontent = dedupedFaq;
    }

    if (entryFixes > 0) {
      entriesWithGrammarFixes++;
      totalGrammarFixes += entryFixes;
    }

    // Write out cleaned entry
    outputStream.write(JSON.stringify(processed) + '\n');

    // Collect a compact representation for similarity audit
    const mainText = [
      processed.aboutcontent || '',
      processed.promodetailscontent || '',
      Array.isArray(processed.faqcontent)
        ? processed.faqcontent.map(f => f.answerHtml || '').join(' ')
        : ''
    ].join(' ');

    entriesForSimilarity.push({
      slug: processed.slug || `__idx_${total}`,
      text: mainText
    });

    if (total % 1000 === 0) {
      console.log(`Processed ${total} entries...`);
    }
  }

  outputStream.end();

  console.log('');
  console.log('CLEANUP PHASE COMPLETE');
  console.log('----------------------');
  console.log(`Total entries processed:     ${total}`);
  console.log(`Entries with grammar fixes:  ${entriesWithGrammarFixes}`);
  console.log(`Total grammar fixes applied: ${totalGrammarFixes}`);
  console.log(`Entries with FAQ changes:    ${entriesWithFaqChanges}`);
  console.log(`Total FAQ answers:           ${totalFaqAnswers}`);
  console.log(`FAQ answers touched:         ${faqAnswersTouched}`);
  console.log('');

  // ========================================================================
  // SIMILARITY SAMPLE AUDIT
  // ========================================================================

  console.log('Running similarity sample audit on main content...');

  const n = entriesForSimilarity.length;
  const pairs = [];

  // Deterministic sampling of index pairs (i, j)
  // Step through with stride to avoid O(n^2) explosion
  const step = Math.max(1, Math.floor(n / 200)); // about 200 entries sampled
  for (let i = 0; i < n; i += step) {
    for (let j = i + 1; j < n; j += step) {
      pairs.push([i, j]);
    }
  }

  // If too many pairs, randomly trim down to MAX_PAIRS_TO_SAMPLE
  if (pairs.length > MAX_PAIRS_TO_SAMPLE) {
    // simple reservoir-like random trim
    pairs.sort(() => Math.random() - 0.5);
    pairs.length = MAX_PAIRS_TO_SAMPLE;
  }

  let rougeViolations = 0;
  let cosineViolations = 0;

  const topPairsByRougeL = [];
  const topPairsByCosine = [];

  function considerTopPairs(arr, value, meta, maxSize = 50) {
    arr.push({ value, ...meta });
    arr.sort((a, b) => b.value - a.value);
    if (arr.length > maxSize) arr.length = maxSize;
  }

  for (const [i, j] of pairs) {
    const a = entriesForSimilarity[i];
    const b = entriesForSimilarity[j];

    const text1 = a.text;
    const text2 = b.text;

    const rougeL = rougeLScore(text1, text2);
    const cosine = cosineSimilarity(text1, text2);

    if (rougeL >= SIM_THRESHOLDS.maxRougeL) rougeViolations++;
    if (cosine >= SIM_THRESHOLDS.maxCosine) cosineViolations++;

    considerTopPairs(
      topPairsByRougeL,
      rougeL,
      { slug1: a.slug, slug2: b.slug }
    );

    considerTopPairs(
      topPairsByCosine,
      cosine,
      { slug1: a.slug, slug2: b.slug }
    );
  }

  const totalPairs = pairs.length || 1;
  const rougeViolationPct = (rougeViolations / totalPairs) * 100;
  const cosineViolationPct = (cosineViolations / totalPairs) * 100;

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      inputFile: INPUT_FILE,
      outputFile: OUTPUT_FILE,
      totalEntries: n,
      totalPairsSampled: totalPairs,
      thresholds: SIM_THRESHOLDS
    },
    summary: {
      rougeL: {
        violationCount: rougeViolations,
        violationPct: rougeViolationPct
      },
      cosine: {
        violationCount: cosineViolations,
        violationPct: cosineViolationPct
      }
    },
    topPairsByRougeL: topPairsByRougeL.map(p => ({
      slug1: p.slug1,
      slug2: p.slug2,
      rougeL: p.value
    })),
    topPairsByCosine: topPairsByCosine.map(p => ({
      slug1: p.slug1,
      slug2: p.slug2,
      cosine: p.value
    }))
  };

  fs.writeFileSync(SIMILARITY_REPORT_FILE, JSON.stringify(report, null, 2));

  console.log('');
  console.log('SIMILARITY SAMPLE AUDIT COMPLETE');
  console.log('--------------------------------');
  console.log(`Pairs sampled:                ${totalPairs}`);
  console.log(`ROUGE-L >= ${SIM_THRESHOLDS.maxRougeL}:  ${rougeViolations} (${rougeViolationPct.toFixed(2)}%)`);
  console.log(`Cosine  >= ${SIM_THRESHOLDS.maxCosine}:  ${cosineViolations} (${cosineViolationPct.toFixed(2)}%)`);
  console.log('');
  console.log('Top ROUGE-L pairs (for manual review) are in:');
  console.log(`  - ${SIMILARITY_REPORT_FILE}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('MASTER CLEANUP DONE – PUBLISH-READY FILE CREATED');
  console.log('='.repeat(60));
  console.log(`Publish-ready JSONL: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
