#!/usr/bin/env node
/**
 * Quality Audit Script
 *
 * Analyzes content quality metrics for each entry:
 * - About content word count
 * - Redeem step count
 * - Promo bullet count
 * - Terms bullet count
 * - FAQ count
 *
 * Flags entries that may be "thin" or have quality issues.
 */

import fs from 'fs';
import readline from 'readline';

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  minAboutWords: 80,
  minRedeemSteps: 3,
  minPromoBullets: 3,
  minTermsBullets: 2,
  minFaqCount: 3,
  maxAboutWords: 500,  // Flag if suspiciously long
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text) {
  const clean = stripHtml(text);
  return clean.split(/\s+/).filter(w => w.length > 0).length;
}

function countListItems(html) {
  if (!html) return 0;
  const matches = html.match(/<li>/gi);
  return matches ? matches.length : 0;
}

function analyzeEntry(entry) {
  const metrics = {
    slug: entry.slug,
    aboutWordCount: countWords(entry.aboutcontent || ''),
    redeemStepCount: countListItems(entry.howtoredeemcontent || ''),
    promoBulletCount: countListItems(entry.promodetailscontent || ''),
    termsBulletCount: countListItems(entry.termscontent || ''),
    faqCount: Array.isArray(entry.faqcontent) ? entry.faqcontent.length : 0,
  };

  // Check for quality issues
  const issues = [];

  if (metrics.aboutWordCount < THRESHOLDS.minAboutWords) {
    issues.push(`About too short (${metrics.aboutWordCount} words)`);
  }
  if (metrics.aboutWordCount > THRESHOLDS.maxAboutWords) {
    issues.push(`About suspiciously long (${metrics.aboutWordCount} words)`);
  }
  if (metrics.redeemStepCount < THRESHOLDS.minRedeemSteps) {
    issues.push(`Too few redeem steps (${metrics.redeemStepCount})`);
  }
  if (metrics.promoBulletCount < THRESHOLDS.minPromoBullets) {
    issues.push(`Too few promo bullets (${metrics.promoBulletCount})`);
  }
  if (metrics.termsBulletCount < THRESHOLDS.minTermsBullets) {
    issues.push(`Too few terms bullets (${metrics.termsBulletCount})`);
  }
  if (metrics.faqCount < THRESHOLDS.minFaqCount) {
    issues.push(`Too few FAQs (${metrics.faqCount})`);
  }

  return { metrics, issues };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const inputFile = process.argv[2] || 'data/content/master/successes-rewritten-grammar-fixed.jsonl';
  const csvOutput = 'analysis/quality-audit.csv';
  const flaggedOutput = 'analysis/quality-flagged-entries.json';

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('QUALITY AUDIT SCRIPT');
  console.log('='.repeat(60));
  console.log(`Input: ${inputFile}`);
  console.log('');
  console.log('Quality thresholds:');
  console.log(`  Min about words:    ${THRESHOLDS.minAboutWords}`);
  console.log(`  Min redeem steps:   ${THRESHOLDS.minRedeemSteps}`);
  console.log(`  Min promo bullets:  ${THRESHOLDS.minPromoBullets}`);
  console.log(`  Min terms bullets:  ${THRESHOLDS.minTermsBullets}`);
  console.log(`  Min FAQ count:      ${THRESHOLDS.minFaqCount}`);
  console.log('');

  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const allMetrics = [];
  const flaggedEntries = [];
  const stats = {
    total: 0,
    thinAbout: 0,
    fewRedeem: 0,
    fewPromo: 0,
    fewTerms: 0,
    fewFaq: 0,
    passedAll: 0
  };

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);
      const { metrics, issues } = analyzeEntry(entry);

      allMetrics.push(metrics);
      stats.total++;

      if (issues.length > 0) {
        flaggedEntries.push({ slug: entry.slug, issues, metrics });

        if (metrics.aboutWordCount < THRESHOLDS.minAboutWords) stats.thinAbout++;
        if (metrics.redeemStepCount < THRESHOLDS.minRedeemSteps) stats.fewRedeem++;
        if (metrics.promoBulletCount < THRESHOLDS.minPromoBullets) stats.fewPromo++;
        if (metrics.termsBulletCount < THRESHOLDS.minTermsBullets) stats.fewTerms++;
        if (metrics.faqCount < THRESHOLDS.minFaqCount) stats.fewFaq++;
      } else {
        stats.passedAll++;
      }

      if (stats.total % 2000 === 0) {
        console.log(`Analyzed ${stats.total} entries...`);
      }
    } catch (err) {
      console.error(`Error parsing line: ${err.message}`);
    }
  }

  // Write CSV
  const csvHeader = 'slug,aboutWordCount,redeemStepCount,promoBulletCount,termsBulletCount,faqCount\n';
  const csvRows = allMetrics.map(m =>
    `${m.slug},${m.aboutWordCount},${m.redeemStepCount},${m.promoBulletCount},${m.termsBulletCount},${m.faqCount}`
  ).join('\n');
  fs.writeFileSync(csvOutput, csvHeader + csvRows);

  // Write flagged entries
  fs.writeFileSync(flaggedOutput, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      thresholds: THRESHOLDS,
      totalFlagged: flaggedEntries.length
    },
    entries: flaggedEntries
  }, null, 2));

  // Calculate averages
  const avgAbout = (allMetrics.reduce((sum, m) => sum + m.aboutWordCount, 0) / allMetrics.length).toFixed(1);
  const avgRedeem = (allMetrics.reduce((sum, m) => sum + m.redeemStepCount, 0) / allMetrics.length).toFixed(1);
  const avgPromo = (allMetrics.reduce((sum, m) => sum + m.promoBulletCount, 0) / allMetrics.length).toFixed(1);
  const avgTerms = (allMetrics.reduce((sum, m) => sum + m.termsBulletCount, 0) / allMetrics.length).toFixed(1);
  const avgFaq = (allMetrics.reduce((sum, m) => sum + m.faqCount, 0) / allMetrics.length).toFixed(1);

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('QUALITY AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log('OVERALL STATISTICS:');
  console.log(`  Total entries:      ${stats.total}`);
  console.log(`  Passed all checks:  ${stats.passedAll} (${(stats.passedAll / stats.total * 100).toFixed(1)}%)`);
  console.log(`  Flagged entries:    ${flaggedEntries.length} (${(flaggedEntries.length / stats.total * 100).toFixed(1)}%)`);
  console.log('');
  console.log('ISSUE BREAKDOWN:');
  console.log(`  Thin about content: ${stats.thinAbout}`);
  console.log(`  Few redeem steps:   ${stats.fewRedeem}`);
  console.log(`  Few promo bullets:  ${stats.fewPromo}`);
  console.log(`  Few terms bullets:  ${stats.fewTerms}`);
  console.log(`  Few FAQs:           ${stats.fewFaq}`);
  console.log('');
  console.log('AVERAGES:');
  console.log(`  Avg about words:    ${avgAbout}`);
  console.log(`  Avg redeem steps:   ${avgRedeem}`);
  console.log(`  Avg promo bullets:  ${avgPromo}`);
  console.log(`  Avg terms bullets:  ${avgTerms}`);
  console.log(`  Avg FAQ count:      ${avgFaq}`);
  console.log('');
  console.log('OUTPUT FILES:');
  console.log(`  CSV metrics:        ${csvOutput}`);
  console.log(`  Flagged entries:    ${flaggedOutput}`);

  // Show sample of flagged entries
  if (flaggedEntries.length > 0) {
    console.log('');
    console.log('SAMPLE FLAGGED ENTRIES (first 10):');
    flaggedEntries.slice(0, 10).forEach(e => {
      console.log(`  ${e.slug}: ${e.issues.join(', ')}`);
    });
    if (flaggedEntries.length > 10) {
      console.log(`  ... and ${flaggedEntries.length - 10} more`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
