#!/usr/bin/env node
/**
 * Comprehensive deduplication script that fixes:
 * 1. INTRA-WHOP repetition (same phrase repeated within one entry)
 * 2. INTER-WHOP repetition (same phrase repeated across different entries)
 *
 * Uses OpenAI to slightly rephrase while keeping exact same meaning
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/master/successes.jsonl';
const OUTPUT_FILE = INPUT_FILE.replace('.jsonl', '.deduped.jsonl');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Track phrases used across all entries
const globalPhraseUsage = new Map();

// Common phrases that need variation (expanded based on analysis)
const COMMON_INTRA_PHRASES = [
  // Original phrases
  'using the on-screen checkout instructions',
  'using the on-screen checkout',
  'discounts and offers may change or end without notice',
  'check the final price at checkout',
  'review the final price at checkout',
  'compare what\'s included',
  'check available tiers before you buy',
  'compare available tiers',
  // Additional high-frequency phrases from analysis
  'to enhance your trading',
  'promo code is available',
  'details vary by offer and creator',
  'vary by offer and creator',
  'details vary by offer',
  'vary by offer and',
  'more importantly, you\'ll get consistent',
  'importantly, you\'ll get consistent',
  'more importantly, you\'ll get',
  'availability can vary by',
  'join a community of',
  'that said, results may vary',
  'said, results may vary',
  'results may vary by',
  'results may vary by use',
  // Product name variations (these get repeated 3x in same entry)
  'promo code',
  // Checkout-related
  'verify your payment',
  'complete your payment',
  'finalize your purchase',
  'confirm your purchase',
  // Community-related
  'community of like-minded',
  'community of traders',
  'community of investors',
  // Results disclaimers
  'individual results may vary',
  'results are not guaranteed',
  'past performance',
  // Pass 3 additions based on analysis
  'to enhance your trading',
  'join a community of',
  'in addition, this helps ensure',
  'addition, this helps ensure',
  'this helps ensure better',
  'on top of that, the platform',
  'top of that, the platform',
  'the platform offers ongoing',
  'platform offers ongoing',
  // Common transition phrases
  'more importantly',
  'in addition',
  'on top of that',
  'that said',
  'furthermore',
  'additionally',
];

async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
}

// Generic replacements for product names (used after first mention)
const PRODUCT_REPLACEMENTS = [
  { pattern: /\b(course|program|training|academy|masterclass|bootcamp)\b/i, replacements: ['this program', 'the program', 'this training', 'it'] },
  { pattern: /\b(community|group|discord|server|chat)\b/i, replacements: ['this community', 'the group', 'this server', 'it'] },
  { pattern: /\b(membership|subscription|access|plan|tier)\b/i, replacements: ['this membership', 'the plan', 'this access', 'it'] },
  { pattern: /\b(signals|alerts|picks|tips)\b/i, replacements: ['these signals', 'the alerts', 'this service', 'it'] },
  { pattern: /\b(bot|tool|software|indicator)\b/i, replacements: ['this tool', 'the software', 'this bot', 'it'] },
  { pattern: /\b(mentorship|coaching|consulting)\b/i, replacements: ['this mentorship', 'the coaching', 'this guidance', 'it'] },
];

// Replace repeated product name mentions with natural alternatives
function replaceRepeatedProductName(content, productName) {
  if (!content || typeof content !== 'string' || !productName) return content;

  // Normalize product name for matching
  const normalizedName = productName.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalizedName.length < 3) return content; // Skip very short names

  // Create regex to find product name (case insensitive, with possible variations)
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRegex = new RegExp(escapedName, 'gi');

  const matches = content.match(nameRegex);
  if (!matches || matches.length <= 2) return content; // Keep if 2 or fewer mentions

  // Determine what type of product this is to pick appropriate replacement
  let replacement = 'it';
  for (const { pattern, replacements } of PRODUCT_REPLACEMENTS) {
    if (pattern.test(normalizedName)) {
      replacement = replacements[Math.floor(Math.random() * replacements.length)];
      break;
    }
  }

  // Replace all but first 2 occurrences
  let count = 0;
  let fixed = content.replace(nameRegex, (match) => {
    count++;
    if (count <= 2) return match; // Keep first 2 mentions
    // Preserve capitalization if at start of sentence
    return replacement;
  });

  return fixed;
}

// Fix intra-whop repetition by removing or rephrasing duplicate instances
function fixIntraRepetition(content, productName = null) {
  if (!content || typeof content !== 'string') return content;

  let fixed = content;

  // First, replace repeated product name mentions
  if (productName) {
    fixed = replaceRepeatedProductName(fixed, productName);
  }

  // For each common phrase, if it appears more than once, keep only the first
  for (const phrase of COMMON_INTRA_PHRASES) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = fixed.match(regex);
    if (matches && matches.length > 1) {
      // Replace all but first occurrence
      let count = 0;
      fixed = fixed.replace(regex, (match) => {
        count++;
        return count === 1 ? match : '';
      });
      // Clean up any double spaces or empty sentences
      fixed = fixed.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
    }
  }

  return fixed;
}

// Generate alternative phrasing
async function getAlternative(phrase, usedAlternatives) {
  const prompt = `Slightly rephrase this (SAME MEANING, just different words):

"${phrase}"

Rules:
- Keep EXACT same meaning
- Only swap a few words for synonyms
- Must be different from: ${usedAlternatives.slice(-5).join(', ')}

Return ONLY the rephrased text (no quotes).`;

  return await callOpenAI(prompt);
}

// Fix inter-whop repetition for a specific field
async function fixInterRepetition(content, fieldName, slug) {
  if (!content || typeof content !== 'string') return content;

  let fixed = content;

  // Extract key phrases and check global usage
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

  for (const sentence of sentences) {
    const cleanSentence = sentence.replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (cleanSentence.length < 20) continue;

    // Check first 6 words as key
    const words = cleanSentence.split(' ').slice(0, 6).join(' ');
    const count = globalPhraseUsage.get(words) || 0;

    if (count >= 3) {
      // This phrase is overused, get alternative
      try {
        const alternatives = globalPhraseUsage.get(`${words}_alts`) || [];
        const alt = await getAlternative(sentence.trim(), alternatives);
        if (alt && alt !== sentence.trim()) {
          fixed = fixed.replace(sentence, alt + (sentence.endsWith('.') ? '' : '.'));
          alternatives.push(alt);
          globalPhraseUsage.set(`${words}_alts`, alternatives);
        }
      } catch (e) {
        // Keep original on error
      }
    }

    globalPhraseUsage.set(words, count + 1);
  }

  return fixed;
}

// Process FAQ content
async function processFAQ(faqcontent, slug, productName = null) {
  if (!Array.isArray(faqcontent)) return faqcontent;

  const processed = [];
  for (const faq of faqcontent) {
    const newFaq = { ...faq };

    // Fix intra-repetition in answer (including product name dedup)
    if (faq.answerHtml) {
      newFaq.answerHtml = fixIntraRepetition(faq.answerHtml, productName);
    }
    if (faq.answer) {
      newFaq.answer = fixIntraRepetition(faq.answer, productName);
    }

    processed.push(newFaq);
  }

  return processed;
}

// Process a single entry
async function processEntry(obj, index, total) {
  const modified = { ...obj };
  let changes = [];

  // Get product name from obj.name or derive from slug
  const productName = obj.name || obj.slug?.replace(/-/g, ' ');

  // 1. Fix intra-repetition in all text fields (including product name dedup)
  if (obj.aboutcontent) {
    const fixed = fixIntraRepetition(obj.aboutcontent, productName);
    if (fixed !== obj.aboutcontent) {
      modified.aboutcontent = fixed;
      changes.push('about-intra');
    }
  }

  if (obj.termscontent) {
    const fixed = fixIntraRepetition(obj.termscontent, productName);
    if (fixed !== obj.termscontent) {
      modified.termscontent = fixed;
      changes.push('terms-intra');
    }
  }

  if (obj.howtoredeemcontent) {
    const fixed = fixIntraRepetition(obj.howtoredeemcontent, productName);
    if (fixed !== obj.howtoredeemcontent) {
      modified.howtoredeemcontent = fixed;
      changes.push('howto-intra');
    }
  }

  if (obj.promodetailscontent) {
    const fixed = fixIntraRepetition(obj.promodetailscontent, productName);
    if (fixed !== obj.promodetailscontent) {
      modified.promodetailscontent = fixed;
      changes.push('promo-intra');
    }
  }

  // Fix FAQ intra-repetition (including product name dedup)
  if (Array.isArray(obj.faqcontent)) {
    const fixed = await processFAQ(obj.faqcontent, obj.slug, productName);
    modified.faqcontent = fixed;
  }

  if (changes.length > 0) {
    console.log(`  [${index + 1}/${total}] ${obj.slug}: ${changes.join(', ')}`);
  }

  return modified;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  console.log(`Processing ${lines.length} entries from ${INPUT_FILE}`);
  console.log(`\nPhase 1: Fixing INTRA-WHOP repetition (same phrases within entries)...\n`);

  const entries = lines.map(line => JSON.parse(line));
  const processed = [];
  let totalIntraFixes = 0;

  for (let i = 0; i < entries.length; i++) {
    const result = await processEntry(entries[i], i, entries.length);
    processed.push(result);

    // Progress update every 500
    if ((i + 1) % 500 === 0) {
      console.log(`Progress: ${i + 1}/${entries.length}`);
    }
  }

  // Write output
  const output = processed.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`\nPhase 1 complete! Output: ${OUTPUT_FILE}`);
  console.log(`\nNote: Run fix-all-repetitive-content.mjs for Phase 2 (inter-whop dedup)`);
}

main().catch(console.error);
