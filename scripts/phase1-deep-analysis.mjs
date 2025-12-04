#!/usr/bin/env node
/**
 * PHASE 1: Deep Content Analysis
 *
 * Performs comprehensive analysis on all 8,000+ whop entries:
 * 1. Section segmentation
 * 2. N-gram frequency extraction (2-7 words) per section
 * 3. Structural pattern detection
 * 4. Sentence skeleton extraction
 * 5. FAQ question clustering
 * 6. Redeem-step clustering
 * 7. Page fingerprint extraction
 * 8. Master Duplication Report generation
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/master/successes.jsonl';
const OUTPUT_DIR = 'analysis';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractNgrams(text, minN = 2, maxN = 7) {
  const clean = stripHtml(text).toLowerCase();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  const ngrams = [];

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      if (ngram.length > 10) { // Skip very short ngrams
        ngrams.push(ngram);
      }
    }
  }
  return ngrams;
}

function extractSentences(text) {
  const clean = stripHtml(text);
  return clean.match(/[^.!?]+[.!?]+/g) || [];
}

function extractSentenceOpener(sentence, wordCount = 4) {
  const words = sentence.trim().split(/\s+/);
  return words.slice(0, wordCount).join(' ').toLowerCase();
}

function extractSentenceSkeleton(sentence) {
  // Replace specific nouns/names with placeholders to find patterns
  let skeleton = sentence.toLowerCase()
    .replace(/\b\d+(\.\d+)?\b/g, '[NUM]')
    .replace(/\$\d+/g, '[PRICE]')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '[MONTH]')
    .replace(/\b\d{4}\b/g, '[YEAR]')
    .trim();

  // Get first 6 words as skeleton
  const words = skeleton.split(/\s+/);
  return words.slice(0, 6).join(' ');
}

// ============================================
// SECTION ANALYSIS FUNCTIONS
// ============================================

function analyzeAboutContent(entries) {
  console.log('\n--- Analyzing aboutcontent ---');
  const ngramCounts = new Map();
  const openerCounts = new Map();
  const skeletonCounts = new Map();
  const wordCounts = [];
  const sentenceCounts = [];

  for (const entry of entries) {
    if (!entry.aboutcontent) continue;

    // Word and sentence counts
    const text = stripHtml(entry.aboutcontent);
    wordCounts.push(text.split(/\s+/).length);

    const sentences = extractSentences(entry.aboutcontent);
    sentenceCounts.push(sentences.length);

    // N-grams
    const ngrams = extractNgrams(entry.aboutcontent);
    for (const ng of ngrams) {
      ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
    }

    // Sentence openers
    for (const sent of sentences) {
      const opener = extractSentenceOpener(sent);
      if (opener.length > 5) {
        openerCounts.set(opener, (openerCounts.get(opener) || 0) + 1);
      }

      const skeleton = extractSentenceSkeleton(sent);
      if (skeleton.length > 10) {
        skeletonCounts.set(skeleton, (skeletonCounts.get(skeleton) || 0) + 1);
      }
    }
  }

  return {
    section: 'aboutcontent',
    totalEntries: entries.filter(e => e.aboutcontent).length,
    avgWordCount: Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
    avgSentenceCount: Math.round(sentenceCounts.reduce((a, b) => a + b, 0) / sentenceCounts.length * 10) / 10,
    topNgrams: [...ngramCounts.entries()]
      .filter(([, count]) => count >= 100)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
    topOpeners: [...openerCounts.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topSkeletons: [...skeletonCounts.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
  };
}

function analyzeHowToRedeem(entries) {
  console.log('\n--- Analyzing howtoredeemcontent ---');
  const stepPatterns = new Map();
  const stepCounts = [];
  const verbPatterns = new Map();
  const ngramCounts = new Map();

  for (const entry of entries) {
    const content = entry.howtoredeemcontent;
    if (!content) continue;

    // Handle array format
    if (Array.isArray(content)) {
      stepCounts.push(content.length);
      for (const step of content) {
        if (typeof step === 'string') {
          const opener = extractSentenceOpener(step, 5);
          stepPatterns.set(opener, (stepPatterns.get(opener) || 0) + 1);

          // Extract first verb
          const words = step.toLowerCase().split(/\s+/);
          if (words.length > 0) {
            verbPatterns.set(words[0], (verbPatterns.get(words[0]) || 0) + 1);
          }

          const ngrams = extractNgrams(step);
          for (const ng of ngrams) {
            ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
          }
        }
      }
    }
    // Handle HTML string format
    else if (typeof content === 'string') {
      const items = content.match(/<li>([^<]+)<\/li>/g) || [];
      stepCounts.push(items.length);

      for (const item of items) {
        const text = stripHtml(item);
        const opener = extractSentenceOpener(text, 5);
        stepPatterns.set(opener, (stepPatterns.get(opener) || 0) + 1);

        const ngrams = extractNgrams(text);
        for (const ng of ngrams) {
          ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
        }
      }
    }
  }

  return {
    section: 'howtoredeemcontent',
    totalEntries: entries.filter(e => e.howtoredeemcontent).length,
    avgStepCount: stepCounts.length > 0 ? Math.round(stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length * 10) / 10 : 0,
    stepCountDistribution: stepCounts.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {}),
    topStepPatterns: [...stepPatterns.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topVerbs: [...verbPatterns.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20),
    topNgrams: [...ngramCounts.entries()]
      .filter(([, count]) => count >= 100)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
  };
}

function analyzeFAQContent(entries) {
  console.log('\n--- Analyzing faqcontent ---');
  const questionPatterns = new Map();
  const questionOpeners = new Map();
  const answerOpeners = new Map();
  const answerNgrams = new Map();
  const faqCounts = [];

  for (const entry of entries) {
    const faq = entry.faqcontent;
    if (!faq) continue;

    // Handle array of FAQ objects
    if (Array.isArray(faq)) {
      faqCounts.push(faq.length);

      for (const item of faq) {
        // Question analysis
        if (item.question) {
          const qOpener = extractSentenceOpener(item.question, 4);
          questionOpeners.set(qOpener, (questionOpeners.get(qOpener) || 0) + 1);

          // Full question pattern (first 8 words)
          const fullPattern = extractSentenceOpener(item.question, 8);
          questionPatterns.set(fullPattern, (questionPatterns.get(fullPattern) || 0) + 1);
        }

        // Answer analysis
        const answer = item.answer || item.answerHtml;
        if (answer) {
          const sentences = extractSentences(answer);
          if (sentences.length > 0) {
            const opener = extractSentenceOpener(sentences[0], 5);
            answerOpeners.set(opener, (answerOpeners.get(opener) || 0) + 1);
          }

          const ngrams = extractNgrams(answer);
          for (const ng of ngrams) {
            answerNgrams.set(ng, (answerNgrams.get(ng) || 0) + 1);
          }
        }
      }
    }
  }

  return {
    section: 'faqcontent',
    totalEntries: entries.filter(e => e.faqcontent).length,
    avgFAQCount: faqCounts.length > 0 ? Math.round(faqCounts.reduce((a, b) => a + b, 0) / faqCounts.length * 10) / 10 : 0,
    faqCountDistribution: faqCounts.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {}),
    topQuestionOpeners: [...questionOpeners.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topQuestionPatterns: [...questionPatterns.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topAnswerOpeners: [...answerOpeners.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topAnswerNgrams: [...answerNgrams.entries()]
      .filter(([, count]) => count >= 100)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
  };
}

function analyzePromoDetails(entries) {
  console.log('\n--- Analyzing promodetailscontent ---');
  const ngramCounts = new Map();
  const itemOpeners = new Map();
  const itemCounts = [];

  for (const entry of entries) {
    const content = entry.promodetailscontent;
    if (!content) continue;

    if (typeof content === 'string') {
      const items = content.match(/<li>([^<]+)<\/li>/g) || [];
      itemCounts.push(items.length);

      for (const item of items) {
        const text = stripHtml(item);
        const opener = extractSentenceOpener(text, 4);
        itemOpeners.set(opener, (itemOpeners.get(opener) || 0) + 1);

        const ngrams = extractNgrams(text);
        for (const ng of ngrams) {
          ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
        }
      }
    }
  }

  return {
    section: 'promodetailscontent',
    totalEntries: entries.filter(e => e.promodetailscontent).length,
    avgItemCount: itemCounts.length > 0 ? Math.round(itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length * 10) / 10 : 0,
    topItemOpeners: [...itemOpeners.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topNgrams: [...ngramCounts.entries()]
      .filter(([, count]) => count >= 100)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
  };
}

function analyzeTermsContent(entries) {
  console.log('\n--- Analyzing termscontent ---');
  const ngramCounts = new Map();
  const itemOpeners = new Map();
  const itemCounts = [];

  for (const entry of entries) {
    const content = entry.termscontent;
    if (!content) continue;

    if (typeof content === 'string') {
      const items = content.match(/<li>([^<]+)<\/li>/g) || [];
      itemCounts.push(items.length);

      for (const item of items) {
        const text = stripHtml(item);
        const opener = extractSentenceOpener(text, 4);
        itemOpeners.set(opener, (itemOpeners.get(opener) || 0) + 1);

        const ngrams = extractNgrams(text);
        for (const ng of ngrams) {
          ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
        }
      }
    }
  }

  return {
    section: 'termscontent',
    totalEntries: entries.filter(e => e.termscontent).length,
    avgItemCount: itemCounts.length > 0 ? Math.round(itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length * 10) / 10 : 0,
    topItemOpeners: [...itemOpeners.entries()]
      .filter(([, count]) => count >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50),
    topNgrams: [...ngramCounts.entries()]
      .filter(([, count]) => count >= 100)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
  };
}

// ============================================
// PAGE FINGERPRINT EXTRACTION
// ============================================

function extractPageFingerprints(entries) {
  console.log('\n--- Extracting page fingerprints ---');
  const fingerprints = [];

  for (const entry of entries) {
    const fp = {
      slug: entry.slug,
      aboutWordCount: entry.aboutcontent ? stripHtml(entry.aboutcontent).split(/\s+/).length : 0,
      aboutSentenceCount: entry.aboutcontent ? (extractSentences(entry.aboutcontent)).length : 0,
      redeemStepCount: 0,
      promoItemCount: 0,
      termsItemCount: 0,
      faqCount: 0,
    };

    // Redeem steps
    if (Array.isArray(entry.howtoredeemcontent)) {
      fp.redeemStepCount = entry.howtoredeemcontent.length;
    } else if (typeof entry.howtoredeemcontent === 'string') {
      fp.redeemStepCount = (entry.howtoredeemcontent.match(/<li>/g) || []).length;
    }

    // Promo details
    if (typeof entry.promodetailscontent === 'string') {
      fp.promoItemCount = (entry.promodetailscontent.match(/<li>/g) || []).length;
    }

    // Terms
    if (typeof entry.termscontent === 'string') {
      fp.termsItemCount = (entry.termscontent.match(/<li>/g) || []).length;
    }

    // FAQ
    if (Array.isArray(entry.faqcontent)) {
      fp.faqCount = entry.faqcontent.length;
    }

    fingerprints.push(fp);
  }

  // Analyze fingerprint uniformity
  const uniformityAnalysis = {
    aboutWordCountDistribution: {},
    aboutSentenceCountDistribution: {},
    redeemStepCountDistribution: {},
    promoItemCountDistribution: {},
    termsItemCountDistribution: {},
    faqCountDistribution: {},
  };

  for (const fp of fingerprints) {
    // Bucket word counts by 50s
    const wcBucket = Math.floor(fp.aboutWordCount / 50) * 50;
    uniformityAnalysis.aboutWordCountDistribution[wcBucket] = (uniformityAnalysis.aboutWordCountDistribution[wcBucket] || 0) + 1;

    uniformityAnalysis.aboutSentenceCountDistribution[fp.aboutSentenceCount] =
      (uniformityAnalysis.aboutSentenceCountDistribution[fp.aboutSentenceCount] || 0) + 1;

    uniformityAnalysis.redeemStepCountDistribution[fp.redeemStepCount] =
      (uniformityAnalysis.redeemStepCountDistribution[fp.redeemStepCount] || 0) + 1;

    uniformityAnalysis.promoItemCountDistribution[fp.promoItemCount] =
      (uniformityAnalysis.promoItemCountDistribution[fp.promoItemCount] || 0) + 1;

    uniformityAnalysis.termsItemCountDistribution[fp.termsItemCount] =
      (uniformityAnalysis.termsItemCountDistribution[fp.termsItemCount] || 0) + 1;

    uniformityAnalysis.faqCountDistribution[fp.faqCount] =
      (uniformityAnalysis.faqCountDistribution[fp.faqCount] || 0) + 1;
  }

  return { fingerprints, uniformityAnalysis };
}

// ============================================
// GLOBAL CROSS-SECTION ANALYSIS
// ============================================

function analyzeGlobalPatterns(entries) {
  console.log('\n--- Analyzing global cross-section patterns ---');
  const globalNgrams = new Map();

  for (const entry of entries) {
    // Combine all text content
    const allText = [
      entry.aboutcontent,
      entry.termscontent,
      typeof entry.howtoredeemcontent === 'string' ? entry.howtoredeemcontent :
        (Array.isArray(entry.howtoredeemcontent) ? entry.howtoredeemcontent.join(' ') : ''),
      entry.promodetailscontent,
    ].filter(Boolean).join(' ');

    // Add FAQ content
    if (Array.isArray(entry.faqcontent)) {
      for (const faq of entry.faqcontent) {
        if (faq.answer) {
          const ngrams = extractNgrams(faq.answer);
          for (const ng of ngrams) {
            globalNgrams.set(ng, (globalNgrams.get(ng) || 0) + 1);
          }
        }
      }
    }

    const ngrams = extractNgrams(allText);
    for (const ng of ngrams) {
      globalNgrams.set(ng, (globalNgrams.get(ng) || 0) + 1);
    }
  }

  return {
    topGlobalNgrams: [...globalNgrams.entries()]
      .filter(([, count]) => count >= 300)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200),
    totalUniqueNgrams: globalNgrams.size,
    ngramsOver1000: [...globalNgrams.entries()].filter(([, c]) => c >= 1000).length,
    ngramsOver500: [...globalNgrams.entries()].filter(([, c]) => c >= 500).length,
    ngramsOver300: [...globalNgrams.entries()].filter(([, c]) => c >= 300).length,
  };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('PHASE 1: DEEP CONTENT ANALYSIS');
  console.log('='.repeat(60));
  console.log(`\nInput file: ${INPUT_FILE}`);
  console.log(`Output directory: ${OUTPUT_DIR}/\n`);

  // Load entries
  console.log('Loading entries...');
  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  const entries = lines.map(line => JSON.parse(line));
  console.log(`Loaded ${entries.length} entries\n`);

  // Run all analyses
  const aboutAnalysis = analyzeAboutContent(entries);
  const redeemAnalysis = analyzeHowToRedeem(entries);
  const faqAnalysis = analyzeFAQContent(entries);
  const promoAnalysis = analyzePromoDetails(entries);
  const termsAnalysis = analyzeTermsContent(entries);
  const { fingerprints, uniformityAnalysis } = extractPageFingerprints(entries);
  const globalAnalysis = analyzeGlobalPatterns(entries);

  // Compile Master Duplication Report
  const masterReport = {
    metadata: {
      generatedAt: new Date().toISOString(),
      inputFile: INPUT_FILE,
      totalEntries: entries.length,
    },
    summary: {
      totalUniqueNgrams: globalAnalysis.totalUniqueNgrams,
      ngramsOver1000: globalAnalysis.ngramsOver1000,
      ngramsOver500: globalAnalysis.ngramsOver500,
      ngramsOver300: globalAnalysis.ngramsOver300,
    },
    sectionAnalysis: {
      about: aboutAnalysis,
      howToRedeem: redeemAnalysis,
      faq: faqAnalysis,
      promoDetails: promoAnalysis,
      terms: termsAnalysis,
    },
    globalPatterns: globalAnalysis,
    pageFingerprints: uniformityAnalysis,
  };

  // Write outputs
  console.log('\n--- Writing output files ---');

  fs.writeFileSync(
    `${OUTPUT_DIR}/phase1-master-report.json`,
    JSON.stringify(masterReport, null, 2)
  );
  console.log(`Written: ${OUTPUT_DIR}/phase1-master-report.json`);

  fs.writeFileSync(
    `${OUTPUT_DIR}/phase1-fingerprints.json`,
    JSON.stringify(fingerprints, null, 2)
  );
  console.log(`Written: ${OUTPUT_DIR}/phase1-fingerprints.json`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1 SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n📊 DATASET OVERVIEW:`);
  console.log(`   Total entries: ${entries.length}`);
  console.log(`   Unique n-grams found: ${globalAnalysis.totalUniqueNgrams.toLocaleString()}`);
  console.log(`   N-grams appearing 1000+ times: ${globalAnalysis.ngramsOver1000}`);
  console.log(`   N-grams appearing 500+ times: ${globalAnalysis.ngramsOver500}`);
  console.log(`   N-grams appearing 300+ times: ${globalAnalysis.ngramsOver300}`);

  console.log(`\n📝 ABOUT SECTION:`);
  console.log(`   Entries with content: ${aboutAnalysis.totalEntries}`);
  console.log(`   Avg word count: ${aboutAnalysis.avgWordCount}`);
  console.log(`   Avg sentence count: ${aboutAnalysis.avgSentenceCount}`);
  console.log(`   Top repeated n-grams: ${aboutAnalysis.topNgrams.length}`);

  console.log(`\n📋 HOW TO REDEEM:`);
  console.log(`   Entries with content: ${redeemAnalysis.totalEntries}`);
  console.log(`   Avg step count: ${redeemAnalysis.avgStepCount}`);
  console.log(`   Step count distribution: ${JSON.stringify(redeemAnalysis.stepCountDistribution)}`);

  console.log(`\n❓ FAQ SECTION:`);
  console.log(`   Entries with FAQs: ${faqAnalysis.totalEntries}`);
  console.log(`   Avg FAQ count: ${faqAnalysis.avgFAQCount}`);
  console.log(`   FAQ count distribution: ${JSON.stringify(faqAnalysis.faqCountDistribution)}`);

  console.log(`\n🏷️ PROMO DETAILS:`);
  console.log(`   Entries with content: ${promoAnalysis.totalEntries}`);
  console.log(`   Avg item count: ${promoAnalysis.avgItemCount}`);

  console.log(`\n📜 TERMS:`);
  console.log(`   Entries with content: ${termsAnalysis.totalEntries}`);
  console.log(`   Avg item count: ${termsAnalysis.avgItemCount}`);

  console.log(`\n🔝 TOP 20 MOST REPEATED GLOBAL PATTERNS:`);
  for (const [ngram, count] of globalAnalysis.topGlobalNgrams.slice(0, 20)) {
    console.log(`   ${count.toLocaleString()}x: "${ngram.slice(0, 60)}${ngram.length > 60 ? '...' : ''}"`);
  }

  console.log(`\n📊 PAGE UNIFORMITY (potential template clustering):`);
  console.log(`   About sentence count distribution: ${JSON.stringify(uniformityAnalysis.aboutSentenceCountDistribution)}`);
  console.log(`   Redeem step count distribution: ${JSON.stringify(uniformityAnalysis.redeemStepCountDistribution)}`);
  console.log(`   FAQ count distribution: ${JSON.stringify(uniformityAnalysis.faqCountDistribution)}`);

  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1 COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nFull report saved to: ${OUTPUT_DIR}/phase1-master-report.json`);
  console.log(`Page fingerprints saved to: ${OUTPUT_DIR}/phase1-fingerprints.json`);
  console.log('\n✅ Ready for Phase 2: Asset Generation');
  console.log('   Awaiting confirmation before proceeding.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
