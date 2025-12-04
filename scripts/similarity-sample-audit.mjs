#!/usr/bin/env node
/**
 * Similarity Sample Audit
 *
 * Purpose:
 *  - Check for near-duplicate content between pages, focusing ONLY on the sections
 *    that need to be unique for SEO:
 *      • aboutcontent
 *      • promodetailscontent
 *      • faqcontent[*].answerHtml
 *
 *  - Ignore boilerplate sections that are allowed to repeat:
 *      • howtoredeemcontent
 *      • termscontent
 *
 *  - Sample a subset of page pairs to estimate how many are very similar.
 *
 * Metrics:
 *  - Cosine similarity (bag-of-words)
 *  - ROUGE-L (only computed when cosine >= COSINE_ROUGE_GATE)
 *
 * Output:
 *  - Console summary
 *  - analysis/similarity-sample-report.json
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';

// ============================================================================
// CONFIG
// ============================================================================

const INPUT_FILE = process.argv[2] || 'data/content/master/successes-rewritten-grammar-fixed.jsonl';
const OUTPUT_REPORT = 'analysis/similarity-sample-report.json';

// How many "anchor" pages to sample (max)
const NUM_ANCHORS = 300;

// How many comparison partners per anchor
const COMPARISONS_PER_ANCHOR = 200;

// Similarity thresholds (our internal safety targets)
const COSINE_HIGH_THRESHOLD = 0.85;      // "high similarity"
const ROUGE_L_HIGH_THRESHOLD = 0.70;    // "very similar sequence structure"

// Only compute ROUGE-L when cosine >= this
const COSINE_ROUGE_GATE = 0.70;

// Minimum number of words for a page's main text to be included
const MIN_MAIN_WORDS = 40;

// Maximum number of top pairs to record in report
const MAX_TOP_PAIRS = 100;

// ============================================================================
// TEXT UTILITIES
// ============================================================================

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// Cosine similarity with simple word-frequency vectors
function cosineSimilarity(text1, text2) {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const freq1 = {};
  const freq2 = {};

  for (const t of tokens1) freq1[t] = (freq1[t] || 0) + 1;
  for (const t of tokens2) freq2[t] = (freq2[t] || 0) + 1;

  const allTokens = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const tok of allTokens) {
    const f1 = freq1[tok] || 0;
    const f2 = freq2[tok] || 0;
    dot += f1 * f2;
    norm1 += f1 * f1;
    norm2 += f2 * f2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ROUGE-L (LCS-based) on token sequences
function lcsLength(seq1, seq2) {
  const m = seq1.length;
  const n = seq2.length;
  if (m === 0 || n === 0) return 0;

  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function rougeLScore(text1, text2) {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const lcs = lcsLength(tokens1, tokens2);
  const precision = lcs / tokens2.length;
  const recall = lcs / tokens1.length;

  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ============================================================================
// SAMPLING UTILITIES
// ============================================================================

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function pickRandomIndices(total, count, excludeIndex = null) {
  const indices = new Set();
  while (indices.size < Math.min(count, total - (excludeIndex !== null ? 1 : 0))) {
    const idx = randomInt(total);
    if (excludeIndex !== null && idx === excludeIndex) continue;
    indices.add(idx);
  }
  return Array.from(indices);
}

// ============================================================================
// MAIN
// ============================================================================

async function loadEntries(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Input file not found: ${filePath}`));
    }

    const entries = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    rl.on('line', line => {
      if (!line.trim()) return;
      try {
        const entry = JSON.parse(line);

        const about = stripHtml(entry.aboutcontent || '');
        const promo = stripHtml(entry.promodetailscontent || '');

        let faqText = '';
        if (Array.isArray(entry.faqcontent)) {
          faqText = entry.faqcontent
            .map(f => stripHtml(f.answerHtml || ''))
            .join(' ');
        }

        const mainText = [about, promo, faqText].join(' ').replace(/\s+/g, ' ').trim();
        const wordCount = mainText ? mainText.split(/\s+/).length : 0;

        if (wordCount >= MIN_MAIN_WORDS) {
          entries.push({
            slug: entry.slug,
            mainText,
            wordCount
          });
        }
      } catch (err) {
        // skip invalid lines
      }
    });

    rl.on('close', () => resolve(entries));
    rl.on('error', err => reject(err));
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('SIMILARITY SAMPLE AUDIT (MAIN CONTENT ONLY)');
  console.log('='.repeat(60));
  console.log(`Input file: ${INPUT_FILE}`);
  console.log('');

  const entries = await loadEntries(INPUT_FILE);
  const totalEntries = entries.length;

  if (totalEntries === 0) {
    console.error('No valid entries loaded. Check input file.');
    process.exit(1);
  }

  console.log(`Loaded ${totalEntries} entries with >= ${MIN_MAIN_WORDS} main-content words.`);
  console.log('');

  const numAnchors = Math.min(NUM_ANCHORS, totalEntries);
  const anchorIndices = pickRandomIndices(totalEntries, numAnchors);

  console.log(`Sampling ${numAnchors} anchor entries.`);
  console.log(`Each anchor will be compared to up to ${COMPARISONS_PER_ANCHOR} other entries.`);
  console.log('');

  const stats = {
    totalPairsChecked: 0,
    cosineAboveGate: 0,
    cosineAboveHigh: 0,
    rougeAboveHigh: 0,
    cosineScores: [],
    bins: {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.7': 0,
      '0.7-0.8': 0,
      '0.8-0.9': 0,
      '0.9-1.0': 0
    },
    topPairsByCosine: [],
    topPairsByRougeL: []
  };

  function recordCosineBin(cos) {
    if (cos < 0.2) stats.bins['0.0-0.2']++;
    else if (cos < 0.4) stats.bins['0.2-0.4']++;
    else if (cos < 0.6) stats.bins['0.4-0.6']++;
    else if (cos < 0.7) stats.bins['0.6-0.7']++;
    else if (cos < 0.8) stats.bins['0.7-0.8']++;
    else if (cos < 0.9) stats.bins['0.8-0.9']++;
    else stats.bins['0.9-1.0']++;
  }

  function pushTopPair(list, entry) {
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (list.length > MAX_TOP_PAIRS) {
      list.length = MAX_TOP_PAIRS;
    }
  }

  const start = Date.now();

  for (let i = 0; i < anchorIndices.length; i++) {
    const anchorIdx = anchorIndices[i];
    const anchor = entries[anchorIdx];

    const compareIndices = pickRandomIndices(totalEntries, COMPARISONS_PER_ANCHOR, anchorIdx);

    for (const j of compareIndices) {
      const other = entries[j];

      const cos = cosineSimilarity(anchor.mainText, other.mainText);
      stats.totalPairsChecked++;
      stats.cosineScores.push(cos);
      recordCosineBin(cos);

      if (cos >= COSINE_HIGH_THRESHOLD) {
        stats.cosineAboveHigh++;
      }
      if (cos >= COSINE_ROUGE_GATE) {
        stats.cosineAboveGate++;
      }

      // Track top cosine pairs
      pushTopPair(stats.topPairsByCosine, {
        slug1: anchor.slug,
        slug2: other.slug,
        score: cos
      });

      // Only compute ROUGE-L for pairs with reasonably high cosine
      if (cos >= COSINE_ROUGE_GATE) {
        const rouge = rougeLScore(anchor.mainText, other.mainText);
        if (rouge >= ROUGE_L_HIGH_THRESHOLD) {
          stats.rougeAboveHigh++;
        }

        pushTopPair(stats.topPairsByRougeL, {
          slug1: anchor.slug,
          slug2: other.slug,
          score: rouge,
          cosine: cos
        });
      }
    }

    if ((i + 1) % 20 === 0 || i === anchorIndices.length - 1) {
      const elapsed = (Date.now() - start) / 1000;
      console.log(
        `Anchors processed: ${i + 1}/${numAnchors} | Pairs: ${stats.totalPairsChecked} | ` +
        `${(stats.totalPairsChecked / elapsed).toFixed(1)} pairs/sec`
      );
    }
  }

  const elapsed = (Date.now() - start) / 1000;
  console.log('');
  console.log('='.repeat(60));
  console.log('SIMILARITY SAMPLE AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total pairs checked:   ${stats.totalPairsChecked}`);
  console.log(`Anchors sampled:       ${numAnchors}`);
  console.log(`Time elapsed:          ${elapsed.toFixed(1)}s`);
  console.log('');

  const cosAboveHighPct = stats.totalPairsChecked
    ? (stats.cosineAboveHigh / stats.totalPairsChecked) * 100
    : 0;

  const rougeAboveHighPct = stats.totalPairsChecked
    ? (stats.rougeAboveHigh / stats.totalPairsChecked) * 100
    : 0;

  console.log('Cosine similarity distribution (ALL sampled pairs):');
  Object.entries(stats.bins).forEach(([range, count]) => {
    const pct = stats.totalPairsChecked ? (count / stats.totalPairsChecked) * 100 : 0;
    console.log(`  ${range}: ${count} (${pct.toFixed(2)}%)`);
  });

  console.log('');
  console.log(`Pairs with cosine >= ${COSINE_HIGH_THRESHOLD.toFixed(2)}: ${stats.cosineAboveHigh} (${cosAboveHighPct.toFixed(2)}%)`);
  console.log(`Pairs with ROUGE-L >= ${ROUGE_L_HIGH_THRESHOLD.toFixed(2)} (among gated): ${stats.rougeAboveHigh} (${rougeAboveHighPct.toFixed(2)}% of all pairs)`);
  console.log('');

  // Prepare report object
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      inputFile: INPUT_FILE,
      totalEntries,
      numAnchors,
      comparisonsPerAnchor: COMPARISONS_PER_ANCHOR,
      minMainWords: MIN_MAIN_WORDS,
      thresholds: {
        COSINE_HIGH_THRESHOLD,
        ROUGE_L_HIGH_THRESHOLD,
        COSINE_ROUGE_GATE
      },
      elapsedSeconds: elapsed,
      totalPairsChecked: stats.totalPairsChecked
    },
    summary: {
      cosineHighCount: stats.cosineAboveHigh,
      cosineHighPercentage: cosAboveHighPct,
      rougeHighCount: stats.rougeAboveHigh,
      rougeHighPercentage: rougeAboveHighPct,
      cosineBins: stats.bins
    },
    topPairsByCosine: stats.topPairsByCosine,
    topPairsByRougeL: stats.topPairsByRougeL
  };

  // Ensure analysis dir exists
  const analysisDir = path.dirname(OUTPUT_REPORT);
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2));
  console.log(`Report written to: ${OUTPUT_REPORT}`);

  // Final verdict
  console.log('');
  console.log('='.repeat(60));
  console.log('VERDICT');
  console.log('='.repeat(60));

  const cosinePass = cosAboveHighPct < 5;
  const rougePass = rougeAboveHighPct < 1;

  if (cosinePass && rougePass) {
    console.log('✅ PASS - Content is sufficiently unique for SEO');
    console.log(`   Cosine >= 0.85: ${cosAboveHighPct.toFixed(2)}% (target: < 5%)`);
    console.log(`   ROUGE-L >= 0.70: ${rougeAboveHighPct.toFixed(2)}% (target: < 1%)`);
  } else {
    console.log('⚠️  WARNING - Some similarity thresholds exceeded');
    console.log(`   Cosine >= 0.85: ${cosAboveHighPct.toFixed(2)}% (target: < 5%) ${cosinePass ? '✅' : '❌'}`);
    console.log(`   ROUGE-L >= 0.70: ${rougeAboveHighPct.toFixed(2)}% (target: < 1%) ${rougePass ? '✅' : '❌'}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
