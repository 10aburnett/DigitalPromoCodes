#!/usr/bin/env node
/**
 * Simple synonym replacement to vary repetitive phrases
 * No AI needed - just direct word swaps
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/master/successes.jsonl';
const OUTPUT_FILE = INPUT_FILE.replace('.jsonl', '.synonymed.jsonl');

// Synonym groups - randomly pick one when we encounter the phrase
const SYNONYMS = {
  // "enhance/improve/boost" variations - full rotation
  'to enhance your': ['to improve your', 'to boost your', 'to strengthen your', 'to upgrade your'],
  'to improve your': ['to enhance your', 'to boost your', 'to strengthen your', 'to upgrade your'],
  'to boost your': ['to enhance your', 'to improve your', 'to strengthen your', 'to upgrade your'],
  'to elevate your': ['to enhance your', 'to improve your', 'to boost your', 'to upgrade your'],
  'to strengthen your': ['to enhance your', 'to improve your', 'to boost your', 'to upgrade your'],
  'to upgrade your': ['to enhance your', 'to improve your', 'to boost your', 'to strengthen your'],
  'enhance your trading': ['improve your trading', 'boost your trading', 'strengthen your trading', 'upgrade your trading'],
  'improve your trading': ['enhance your trading', 'boost your trading', 'strengthen your trading', 'upgrade your trading'],
  'boost your trading': ['enhance your trading', 'improve your trading', 'strengthen your trading', 'upgrade your trading'],
  'enhance your betting': ['improve your betting', 'boost your betting', 'strengthen your betting', 'upgrade your betting'],
  'improve your betting': ['enhance your betting', 'boost your betting', 'strengthen your betting', 'upgrade your betting'],
  'boost your betting': ['enhance your betting', 'improve your betting', 'strengthen your betting', 'upgrade your betting'],

  // "join/connect with a community" variations
  'join a community of': ['connect with a community of', 'become part of a community of', 'access a community of'],
  'connect with a community of': ['join a community of', 'become part of a community of', 'access a community of'],
  'with a community of': ['within a community of', 'alongside a community of', 'among a community of'],

  // "in addition" variations
  'in addition': ['additionally', 'furthermore', 'moreover', 'also'],
  'on top of that': ['beyond that', 'in addition to that', 'what\'s more'],

  // "that said" variations
  'that said': ['however', 'nevertheless', 'with that in mind', 'even so'],

  // "results may vary" variations
  'results may vary': ['outcomes can differ', 'results can vary', 'individual results differ'],

  // "the platform offers" variations
  'the platform offers': ['the platform provides', 'the platform delivers', 'the platform includes'],
  'platform offers': ['platform provides', 'platform delivers', 'platform includes'],

  // "promo code" variations
  'promo code is available': ['promotional code is available', 'discount code is available', 'coupon is available'],

  // Checkout variations
  'apply the available discount': ['use the available discount', 'enter the available discount', 'redeem the available discount'],
  'during checkout': ['at checkout', 'when checking out', 'in the checkout process'],
  'lock in pricing': ['secure pricing', 'confirm pricing', 'finalize pricing'],

  // Generic variations
  'this helps ensure': ['this helps guarantee', 'this helps confirm', 'this makes sure'],
  'may apply based on': ['can apply depending on', 'might apply based on', 'could apply depending on'],

  // Trading/betting context
  'trading strategies': ['trading approaches', 'trading methods', 'trading techniques'],
  'betting strategies': ['betting approaches', 'betting methods', 'betting techniques'],

  // More common phrases
  'check the final price': ['verify the final price', 'confirm the final price', 'review the final price'],
  'compare available': ['review available', 'check available', 'explore available'],
  'using the on-screen': ['following the on-screen', 'via the on-screen', 'through the on-screen'],
  'following the on-screen': ['using the on-screen', 'via the on-screen', 'through the on-screen'],

  // High frequency phrases from analysis - region/payment/creator policy
  'region, payment method, or creator policy': ['location, payment method, or creator policy', 'region, payment option, or creator policy', 'area, payment method, or creator terms'],
  'payment method, or creator policy': ['payment option, or creator policy', 'payment method, or creator terms', 'payment type, or creator policy'],

  // "of the current offer" variations
  'of the current offer': ['of the active offer', 'of the present offer', 'of the available offer'],

  // "pricing, then review plan details" chain
  'pricing, then review plan details': ['pricing, then check plan details', 'pricing, then examine plan details', 'pricing, then look over plan details'],
  'then review plan details': ['then check plan details', 'then examine plan details', 'then look over plan details'],
  'review plan details before': ['check plan details before', 'examine plan details before', 'look over plan details before'],
  'plan details before you': ['plan specifics before you', 'plan information before you', 'plan particulars before you'],
  'details before you confirm': ['specifics before you confirm', 'information before you confirm', 'particulars before you confirm'],
  'before you confirm on': ['before you finalize on', 'before you complete on', 'before you proceed on'],
  'you confirm on the': ['you finalize on the', 'you complete on the', 'you proceed on the'],
  'confirm on the final': ['finalize on the final', 'complete on the final', 'proceed on the final'],
  'on the final screen': ['on the checkout screen', 'on the last screen', 'on the confirmation screen'],
  'the final screen, including': ['the checkout screen, including', 'the last screen, including', 'the confirmation screen, including'],
  'final screen, including renewal': ['checkout screen, including renewal', 'last screen, including renewal', 'confirmation screen, including renewal'],

  // "renewal cadence" phrase chain (48x each)
  'screen, including renewal cadence': ['screen, showing renewal schedule', 'screen, displaying renewal frequency', 'screen, with renewal timing'],
  'including renewal cadence and': ['showing renewal schedule and', 'displaying renewal frequency and', 'with renewal timing and'],
  'renewal cadence and any': ['renewal schedule and any', 'renewal frequency and any', 'renewal timing and any'],
  'cadence and any usage': ['schedule and any usage', 'frequency and any usage', 'timing and any usage'],
  'and any usage limits': ['and any usage caps', 'and any usage restrictions', 'and any usage boundaries'],

  // "before purchasing, review" variations
  'before purchasing, review the plan': ['before buying, check the plan', 'prior to purchasing, review the plan', 'before you buy, examine the plan'],
  'purchasing, review the plan details': ['buying, check the plan details', 'purchasing, examine the plan details', 'buying, review the plan specifics'],

  // "strengthen/upgrade your trading" (139x, 66x)
  'strengthen your trading': ['enhance your trading', 'improve your trading', 'boost your trading', 'upgrade your trading'],
  'upgrade your trading': ['enhance your trading', 'improve your trading', 'boost your trading', 'strengthen your trading'],
  'strengthen your betting': ['enhance your betting', 'improve your betting', 'boost your betting', 'upgrade your betting'],
  'upgrade your betting': ['enhance your betting', 'improve your betting', 'boost your betting', 'strengthen your betting'],

  // "confirm the final price" (47x)
  'confirm the final price': ['verify the final price', 'check the final price', 'review the final price'],
  'verify the final price': ['confirm the final price', 'check the final price', 'review the final price'],

  // "a one-time purchase" (44x)
  'a one-time purchase of': ['a single purchase of', 'one purchase of', 'a one-off purchase of'],

  // "remove any prefilled coupon" (43x)
  'remove any prefilled coupon': ['clear any existing coupon', 'delete any prefilled code', 'remove any pre-entered coupon'],
  'prefilled coupon before': ['existing coupon before', 'pre-entered code before', 'applied coupon before'],

  // "take advantage of the" (41x)
  'take advantage of the': ['benefit from the', 'make use of the', 'leverage the'],

  // "a community of over" (36x)
  'a community of over': ['a group of more than', 'a community exceeding', 'a membership of over'],

  // "expected renewal dates" (48x)
  'expected renewal dates': ['anticipated renewal dates', 'scheduled renewal dates', 'projected renewal dates'],
};

// Track which synonym we used last to rotate through them GLOBALLY across all entries
const synonymIndex = new Map();

function getNextSynonym(original) {
  const key = original.toLowerCase();
  if (!SYNONYMS[key]) return original;

  const options = SYNONYMS[key];
  const currentIndex = synonymIndex.get(key) || 0;
  const nextIndex = (currentIndex + 1) % options.length;
  synonymIndex.set(key, nextIndex);

  return options[currentIndex];
}

// For inter-whop: replace ALL occurrences, rotating through synonyms globally
function applyInterWhopSynonyms(content) {
  if (!content || typeof content !== 'string') return content;

  let result = content;

  for (const phrase of Object.keys(SYNONYMS)) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    result = result.replace(regex, (match) => {
      const synonym = getNextSynonym(phrase);
      // Preserve original capitalization
      if (match[0] === match[0].toUpperCase()) {
        return synonym.charAt(0).toUpperCase() + synonym.slice(1);
      }
      return synonym;
    });
  }

  return result;
}

// Apply synonyms to content, keeping first occurrence original
function applySynonyms(content) {
  if (!content || typeof content !== 'string') return content;

  let result = content;

  for (const phrase of Object.keys(SYNONYMS)) {
    // Case insensitive match
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = result.match(regex);

    if (matches && matches.length > 0) {
      let count = 0;
      result = result.replace(regex, (match) => {
        count++;
        // Keep first occurrence, replace subsequent ones
        if (count === 1) return match;

        const synonym = getNextSynonym(phrase);
        // Preserve original capitalization
        if (match[0] === match[0].toUpperCase()) {
          return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        }
        return synonym;
      });
    }
  }

  return result;
}

// Process FAQ content
function processFAQ(faqcontent) {
  if (!Array.isArray(faqcontent)) return faqcontent;

  return faqcontent.map(faq => ({
    ...faq,
    answerHtml: faq.answerHtml ? applyInterWhopSynonyms(faq.answerHtml) : faq.answerHtml,
    answer: faq.answer ? applyInterWhopSynonyms(faq.answer) : faq.answer,
  }));
}

// Process single entry - DO NOT reset synonym index to ensure variety across entries
function processEntry(obj, index, total) {
  const modified = { ...obj };
  let changes = [];

  // NOTE: We do NOT reset synonymIndex here - we want rotation ACROSS entries for inter-whop dedup

  if (obj.aboutcontent) {
    const fixed = applyInterWhopSynonyms(obj.aboutcontent);
    if (fixed !== obj.aboutcontent) {
      modified.aboutcontent = fixed;
      changes.push('about');
    }
  }

  if (obj.termscontent) {
    const fixed = applyInterWhopSynonyms(obj.termscontent);
    if (fixed !== obj.termscontent) {
      modified.termscontent = fixed;
      changes.push('terms');
    }
  }

  if (obj.howtoredeemcontent) {
    const fixed = applyInterWhopSynonyms(obj.howtoredeemcontent);
    if (fixed !== obj.howtoredeemcontent) {
      modified.howtoredeemcontent = fixed;
      changes.push('howto');
    }
  }

  if (obj.promodetailscontent) {
    const fixed = applyInterWhopSynonyms(obj.promodetailscontent);
    if (fixed !== obj.promodetailscontent) {
      modified.promodetailscontent = fixed;
      changes.push('promo');
    }
  }

  if (Array.isArray(obj.faqcontent)) {
    modified.faqcontent = processFAQ(obj.faqcontent);
  }

  if (changes.length > 0 && (index + 1) % 500 === 0) {
    console.log(`  [${index + 1}/${total}] Progress update`);
  }

  return { modified, changes };
}

function main() {
  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  console.log(`Processing ${lines.length} entries from ${INPUT_FILE}`);
  console.log(`Applying synonym replacements...\n`);

  const entries = lines.map(line => JSON.parse(line));
  const processed = [];
  let totalChanges = 0;

  for (let i = 0; i < entries.length; i++) {
    const { modified, changes } = processEntry(entries[i], i, entries.length);
    processed.push(modified);
    if (changes.length > 0) totalChanges++;

    if ((i + 1) % 1000 === 0) {
      console.log(`Progress: ${i + 1}/${entries.length}`);
    }
  }

  // Write output
  const output = processed.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`\nDone! Modified ${totalChanges} entries`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();
