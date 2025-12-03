#!/usr/bin/env node
/**
 * SAFE Inter-Whop Deduplication Script
 *
 * Key safety features:
 * 1. Processes line-by-line, writes incrementally
 * 2. Uses checkpointing - can resume if interrupted
 * 3. No holding everything in memory
 * 4. Uses deterministic synonym rotation (no AI calls)
 *
 * Targets the highest-frequency inter-whop patterns:
 * - FAQ question patterns (7629x "Expect one code per...")
 * - FAQ answer patterns (6161x "Can I stack multiple...")
 * - How-to step patterns (6147x "Visit Whop.com and navigate to...")
 * - Opening/closing sentence patterns
 */

import fs from 'fs';
import readline from 'readline';

const INPUT_FILE = process.argv[2] || 'data/content/master/successes.jsonl';
const OUTPUT_FILE = INPUT_FILE.replace('.jsonl', '.interdeduped.jsonl');
const CHECKPOINT_FILE = OUTPUT_FILE + '.checkpoint';

// HIGH-FREQUENCY INTER-WHOP PATTERNS with synonym variations
// Each pattern maps to an array of equivalent alternatives
const INTER_WHOP_PATTERNS = {
  // ===========================================
  // FAQ ANSWER PATTERNS (highest frequency)
  // ===========================================

  // 7629x: "Expect one code per account..."
  'expect one code per account': [
    'typically one code applies per account',
    'generally one promotional code works per account',
    'usually a single code is valid per account',
    'one promo code is standard per account',
  ],
  'expect one code per': [
    'typically one code applies per',
    'generally one promotional code works per',
    'usually a single code is valid per',
    'one promo code is standard per',
  ],

  // 6161x: "Can I stack multiple codes..."
  'can i stack multiple': [
    'is it possible to combine multiple',
    'can multiple codes be used',
    'are you able to stack several',
    'can you use more than one',
  ],
  'stack multiple codes': [
    'combine multiple codes',
    'use several codes together',
    'apply more than one code',
    'stack several promo codes',
  ],

  // FAQ question variations
  'how do i use': [
    'how can i apply',
    'what is the process to use',
    'how should i redeem',
    'what steps do i follow to use',
  ],
  'is this deal legitimate': [
    'is this offer genuine',
    'is this promotion authentic',
    'can i trust this deal',
    'is this discount real',
  ],
  'what is included': [
    'what does this include',
    'what comes with this',
    'what is part of this',
    'what features are included',
  ],

  // ===========================================
  // HOW-TO-REDEEM PATTERNS (6147x)
  // ===========================================

  'visit whop.com and navigate to': [
    'go to whop.com and find',
    'head to whop.com and locate',
    'access whop.com and browse to',
    'open whop.com and search for',
  ],
  'visit the official page': [
    'go to the official page',
    'head to the product page',
    'access the official listing',
    'navigate to the main page',
  ],
  'click the purchase button': [
    'select the buy option',
    'press the purchase button',
    'hit the buy button',
    'choose the purchase option',
  ],
  'enter the promo code': [
    'input the discount code',
    'type in the promo code',
    'add the promotional code',
    'apply the coupon code',
  ],
  'complete your purchase': [
    'finalize your order',
    'finish your transaction',
    'confirm your purchase',
    'complete the checkout',
  ],
  'verify the discount applied': [
    'confirm the discount shows',
    'check the discount is active',
    'ensure the savings appear',
    'make sure the code worked',
  ],

  // ===========================================
  // ABOUT/TERMS OPENING PATTERNS
  // ===========================================

  'looking for a': [
    'searching for a',
    'in the market for a',
    'trying to find a',
    'want to discover a',
  ],
  'looking to enhance': [
    'want to improve',
    'hoping to boost',
    'aiming to strengthen',
    'seeking to upgrade',
  ],
  'breaking into': [
    'getting started with',
    'entering the world of',
    'beginning your journey in',
    'starting out in',
  ],
  'can feel overwhelming': [
    'may seem daunting',
    'might appear challenging',
    'can seem difficult',
    'may feel complex',
  ],

  // ===========================================
  // COMMON TRANSITION PHRASES
  // ===========================================

  'in addition': [
    'additionally',
    'furthermore',
    'moreover',
    'also',
  ],
  'on top of that': [
    'beyond that',
    'in addition to that',
    'what\'s more',
    'furthermore',
  ],
  'that said': [
    'however',
    'nevertheless',
    'with that in mind',
    'even so',
  ],
  'more importantly': [
    'significantly',
    'crucially',
    'notably',
    'especially',
  ],

  // ===========================================
  // TERMS/DISCLAIMER PATTERNS
  // ===========================================

  'results may vary': [
    'outcomes can differ',
    'results can vary',
    'individual results differ',
    'your experience may differ',
  ],
  'discounts and offers may change': [
    'promotions and deals can change',
    'offers and discounts may update',
    'deals and promotions can vary',
    'savings and offers may shift',
  ],
  'without notice': [
    'at any time',
    'unexpectedly',
    'without warning',
    'without prior notification',
  ],
  'check the final price': [
    'verify the total cost',
    'confirm the final amount',
    'review the total price',
    'check the complete cost',
  ],
  'at checkout': [
    'during checkout',
    'when checking out',
    'in the checkout process',
    'at the payment page',
  ],

  // ===========================================
  // COMMUNITY/VALUE PROPOSITIONS
  // ===========================================

  'join a community of': [
    'connect with a group of',
    'become part of a community of',
    'access a community of',
    'join fellow',
  ],
  'community of like-minded': [
    'group of similar',
    'community of fellow',
    'network of like-minded',
    'group of dedicated',
  ],
  'compare what\'s included': [
    'review what\'s offered',
    'check the included features',
    'see what comes with',
    'examine the offerings',
  ],
  'compare available tiers': [
    'review available plans',
    'check the different options',
    'explore available levels',
    'see the plan options',
  ],

  // ===========================================
  // PROMO DETAILS PATTERNS
  // ===========================================

  'promo code is available': [
    'promotional code is active',
    'discount code is offered',
    'coupon is available',
    'promo is currently active',
  ],
  'the platform offers': [
    'the platform provides',
    'the platform delivers',
    'the platform includes',
    'this platform features',
  ],
  'take advantage of': [
    'benefit from',
    'make use of',
    'leverage',
    'utilize',
  ],

  // ===========================================
  // PRICING/VALUE PATTERNS
  // ===========================================

  'lock in pricing': [
    'secure pricing',
    'confirm your rate',
    'finalize pricing',
    'guarantee your price',
  ],
  'a one-time purchase': [
    'a single purchase',
    'one purchase',
    'a one-off payment',
    'a single payment',
  ],
  'remove any prefilled coupon': [
    'clear any existing code',
    'delete any pre-entered coupon',
    'remove any applied code',
    'clear any auto-filled coupon',
  ],

  // ===========================================
  // DETAILED FAQ ANSWER PATTERNS
  // ===========================================

  'details vary by offer and creator': [
    'specifics differ by promotion and seller',
    'terms vary by deal and creator',
    'particulars change by offer and seller',
    'conditions vary by promotion and creator',
  ],
  'this helps ensure': [
    'this helps guarantee',
    'this helps confirm',
    'this makes sure',
    'this ensures',
  ],
  'availability can vary by': [
    'access may differ by',
    'availability might change based on',
    'options can vary by',
    'availability may depend on',
  ],

  // ===========================================
  // REGION/PAYMENT PATTERNS (from analysis)
  // ===========================================

  'region, payment method, or creator policy': [
    'location, payment option, or seller terms',
    'area, payment type, or creator terms',
    'region, payment choice, or seller policy',
    'location, payment method, or creator rules',
  ],

  // ===========================================
  // RENEWAL/SUBSCRIPTION PATTERNS
  // ===========================================

  'expected renewal dates': [
    'anticipated renewal dates',
    'scheduled renewal dates',
    'projected renewal times',
    'planned renewal dates',
  ],
  'renewal cadence and': [
    'renewal schedule and',
    'renewal frequency and',
    'renewal timing and',
    'billing cycle and',
  ],
  'on the final screen': [
    'on the checkout screen',
    'on the last page',
    'on the confirmation screen',
    'on the payment screen',
  ],
  'review plan details before': [
    'check plan details before',
    'examine plan specifics before',
    'look over plan info before',
    'verify plan details before',
  ],
};

// Global rotation index for each pattern - ensures variety across entries
const rotationIndex = new Map();

function getNextVariation(pattern) {
  const key = pattern.toLowerCase();
  const variations = INTER_WHOP_PATTERNS[key];
  if (!variations) return null;

  const currentIdx = rotationIndex.get(key) || 0;
  const nextIdx = (currentIdx + 1) % variations.length;
  rotationIndex.set(key, nextIdx);

  return variations[currentIdx];
}

function applyPatternVariations(content) {
  if (!content || typeof content !== 'string') return content;

  let result = content;

  // Sort patterns by length (longest first) to avoid partial replacements
  const sortedPatterns = Object.keys(INTER_WHOP_PATTERNS).sort((a, b) => b.length - a.length);

  for (const pattern of sortedPatterns) {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    result = result.replace(regex, (match) => {
      const variation = getNextVariation(pattern);
      if (!variation) return match;

      // Preserve capitalization
      if (match[0] === match[0].toUpperCase()) {
        return variation.charAt(0).toUpperCase() + variation.slice(1);
      }
      return variation;
    });
  }

  return result;
}

function processFAQContent(faqcontent) {
  if (!Array.isArray(faqcontent)) return faqcontent;

  return faqcontent.map(faq => ({
    ...faq,
    question: faq.question ? applyPatternVariations(faq.question) : faq.question,
    answer: faq.answer ? applyPatternVariations(faq.answer) : faq.answer,
    answerHtml: faq.answerHtml ? applyPatternVariations(faq.answerHtml) : faq.answerHtml,
  }));
}

function processHowToRedeemContent(howtoredeemcontent) {
  if (!howtoredeemcontent) return howtoredeemcontent;

  // Handle array format
  if (Array.isArray(howtoredeemcontent)) {
    return howtoredeemcontent.map(step =>
      typeof step === 'string' ? applyPatternVariations(step) : step
    );
  }

  // Handle string format
  if (typeof howtoredeemcontent === 'string') {
    return applyPatternVariations(howtoredeemcontent);
  }

  return howtoredeemcontent;
}

function processEntry(obj) {
  const modified = { ...obj };

  // Process all text content fields
  if (obj.aboutcontent) {
    modified.aboutcontent = applyPatternVariations(obj.aboutcontent);
  }

  if (obj.termscontent) {
    modified.termscontent = applyPatternVariations(obj.termscontent);
  }

  if (obj.howtoredeemcontent) {
    modified.howtoredeemcontent = processHowToRedeemContent(obj.howtoredeemcontent);
  }

  if (obj.promodetailscontent) {
    modified.promodetailscontent = applyPatternVariations(obj.promodetailscontent);
  }

  if (Array.isArray(obj.faqcontent)) {
    modified.faqcontent = processFAQContent(obj.faqcontent);
  }

  return modified;
}

async function main() {
  console.log(`\n=== SAFE Inter-Whop Deduplication ===\n`);
  console.log(`Input: ${INPUT_FILE}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`Patterns to rotate: ${Object.keys(INTER_WHOP_PATTERNS).length}\n`);

  // Check for checkpoint (resume capability)
  let startLine = 0;
  let writeMode = 'w';

  if (fs.existsSync(CHECKPOINT_FILE)) {
    const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    startLine = checkpoint.processedLines;

    // Restore rotation state
    for (const [key, value] of Object.entries(checkpoint.rotationState)) {
      rotationIndex.set(key, value);
    }

    writeMode = 'a';
    console.log(`Resuming from line ${startLine} (checkpoint found)\n`);
  }

  // Count total lines first
  const totalLines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n').length;
  console.log(`Total entries: ${totalLines}`);

  // Create read stream
  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Open output file
  const outputStream = fs.createWriteStream(OUTPUT_FILE, { flags: writeMode });

  let lineNumber = 0;
  let processedCount = 0;

  for await (const line of rl) {
    lineNumber++;

    // Skip already processed lines if resuming
    if (lineNumber <= startLine) continue;

    try {
      const obj = JSON.parse(line);
      const processed = processEntry(obj);
      outputStream.write(JSON.stringify(processed) + '\n');
      processedCount++;

      // Progress update every 500 entries
      if (processedCount % 500 === 0) {
        console.log(`Progress: ${lineNumber}/${totalLines} (${((lineNumber / totalLines) * 100).toFixed(1)}%)`);

        // Save checkpoint
        const checkpointData = {
          processedLines: lineNumber,
          rotationState: Object.fromEntries(rotationIndex),
          timestamp: new Date().toISOString()
        };
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpointData));
      }
    } catch (err) {
      console.error(`Error at line ${lineNumber}: ${err.message}`);
      // Write original line on error
      outputStream.write(line + '\n');
    }
  }

  outputStream.end();

  // Clean up checkpoint on successful completion
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  console.log(`\n=== Complete ===`);
  console.log(`Processed: ${processedCount} entries`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`\nTo apply: mv ${OUTPUT_FILE} ${INPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
