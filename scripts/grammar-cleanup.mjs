#!/usr/bin/env node
/**
 * Grammar Cleanup Script (Conservative Version)
 *
 * Fixes common grammatical issues that were introduced during earlier content
 * generation steps. This script is MEANING-PRESERVING and CONSERVATIVE.
 *
 * It ONLY fixes:
 * - Obviously broken placeholder artefacts like "the it", "the this", "this this"
 * - Basic spacing/punctuation issues and double spaces
 * - Worst "it" phrases like "enhance your it experience"
 *
 * It does NOT:
 * - Inject specific nouns that might be wrong for some whops
 * - Change meaning or evidence
 * - Touch numbers, percentages, or disclaimers
 */

import fs from 'fs';
import readline from 'readline';

// ============================================================================
// CONSERVATIVE GRAMMAR FIX PATTERNS
// ============================================================================

const GRAMMAR_FIXES = [
  // -------------------------------------------------------------------------
  // Fix "the it" patterns - replace with neutral alternatives, NOT "platform"
  // -------------------------------------------------------------------------
  { pattern: /\bThe it provides\b/g, replacement: 'This provides' },
  { pattern: /\bThe it offers\b/g, replacement: 'This offers' },
  { pattern: /\bThe it includes\b/g, replacement: 'This includes' },
  { pattern: /\bThe it gives\b/g, replacement: 'This gives' },
  { pattern: /\bThe it helps\b/g, replacement: 'This helps' },
  { pattern: /\bThe it is\b/g, replacement: 'This is' },
  { pattern: /\bThe it has\b/g, replacement: 'This has' },
  { pattern: /\bthe it\b/gi, replacement: 'this' },

  // -------------------------------------------------------------------------
  // Fix "this it" patterns
  // -------------------------------------------------------------------------
  { pattern: /\bthis it\b/gi, replacement: 'this' },
  { pattern: /\bThis it\b/g, replacement: 'This' },

  // -------------------------------------------------------------------------
  // Fix "the this" patterns
  // -------------------------------------------------------------------------
  { pattern: /\bthe this\b/gi, replacement: 'this' },
  { pattern: /\bThe this\b/g, replacement: 'This' },
  { pattern: /\butilizing the this\b/gi, replacement: 'utilizing this' },
  { pattern: /\bUsing the this\b/g, replacement: 'Using this' },

  // -------------------------------------------------------------------------
  // Fix double word patterns
  // -------------------------------------------------------------------------
  { pattern: /\bthis this\b/gi, replacement: 'this' },
  { pattern: /\bThis this\b/g, replacement: 'This' },
  { pattern: /\bthe the\b/gi, replacement: 'the' },
  { pattern: /\bThe the\b/g, replacement: 'The' },
  { pattern: /\ba a\b/gi, replacement: 'a' },
  { pattern: /\ban an\b/gi, replacement: 'an' },
  { pattern: /\ba an\b/gi, replacement: 'an' },
  { pattern: /\ban a\b/gi, replacement: 'a' },

  // -------------------------------------------------------------------------
  // Fix "community" placeholder issues (conservative)
  // -------------------------------------------------------------------------
  { pattern: /\bthe this community\b/gi, replacement: 'this community' },
  { pattern: /\bThe this community\b/g, replacement: 'This community' },
  { pattern: /\butilizing the this community\b/gi, replacement: 'utilizing this community' },
  // Fix "on this community" → "in this community" (grammatically correct)
  { pattern: /\bon this community\b/gi, replacement: 'in this community' },
  // Fix "save on this community services" → "save on community services"
  { pattern: /\bsave on this community services\b/gi, replacement: 'save on community services' },
  { pattern: /\bsave in this community services\b/gi, replacement: 'save on community services' },

  // -------------------------------------------------------------------------
  // Fix awkward "your it" patterns - remove the broken "it"
  // -------------------------------------------------------------------------
  { pattern: /\benhance your it experience\b/gi, replacement: 'enhance your experience' },
  { pattern: /\bimprove your it experience\b/gi, replacement: 'improve your experience' },
  { pattern: /\byour it experience\b/gi, replacement: 'your experience' },
  { pattern: /\byour it journey\b/gi, replacement: 'your journey' },
  { pattern: /\byour it subscription\b/gi, replacement: 'your subscription' },
  { pattern: /\byour it membership\b/gi, replacement: 'your membership' },
  { pattern: /\byour it access\b/gi, replacement: 'your access' },

  // -------------------------------------------------------------------------
  // Fix double opportunity/chance patterns from phrase replacement
  // -------------------------------------------------------------------------
  { pattern: /\bthis opportunity for this opportunity\b/gi, replacement: 'this opportunity' },
  { pattern: /\bthis chance for this chance\b/gi, replacement: 'this chance' },
  { pattern: /\bGrab this opportunity for this opportunity\b/gi, replacement: 'Grab this opportunity' },
  { pattern: /\bSeize this chance for this chance\b/gi, replacement: 'Seize this chance' },
  { pattern: /\bHere's your chance for this opportunity\b/gi, replacement: 'Here\'s your chance' },
  { pattern: /\bTake advantage of this opportunity for this opportunity\b/gi, replacement: 'Take advantage of this opportunity' },

  // -------------------------------------------------------------------------
  // Fix spacing issues (careful not to affect HTML tags)
  // These patterns are safe because they only target text content patterns
  // -------------------------------------------------------------------------
  // Remove space before punctuation (but not inside HTML tags)
  { pattern: /([a-zA-Z0-9])\s+,/g, replacement: '$1,' },
  { pattern: /([a-zA-Z0-9])\s+\./g, replacement: '$1.' },
  { pattern: /([a-zA-Z0-9])\s+!/g, replacement: '$1!' },
  { pattern: /([a-zA-Z0-9])\s+\?/g, replacement: '$1?' },

  // Fix multiple spaces (but preserve single spaces)
  { pattern: /  +/g, replacement: ' ' },

  // Fix missing space after sentence-ending punctuation before capital letter
  // (but not inside HTML tags - these patterns only match text content)
  { pattern: /\.([A-Z][a-z])/g, replacement: '. $1' },
  { pattern: /!([A-Z][a-z])/g, replacement: '! $1' },
  { pattern: /\?([A-Z][a-z])/g, replacement: '? $1' },
];

// ============================================================================
// MAIN PROCESSING
// ============================================================================

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

function processEntry(entry) {
  let totalFixes = 0;
  const processed = { ...entry };

  // Fix each content field
  if (processed.aboutcontent) {
    const result = applyGrammarFixes(processed.aboutcontent);
    processed.aboutcontent = result.text;
    totalFixes += result.fixCount;
  }

  if (processed.howtoredeemcontent) {
    const result = applyGrammarFixes(processed.howtoredeemcontent);
    processed.howtoredeemcontent = result.text;
    totalFixes += result.fixCount;
  }

  if (processed.promodetailscontent) {
    const result = applyGrammarFixes(processed.promodetailscontent);
    processed.promodetailscontent = result.text;
    totalFixes += result.fixCount;
  }

  if (processed.termscontent) {
    const result = applyGrammarFixes(processed.termscontent);
    processed.termscontent = result.text;
    totalFixes += result.fixCount;
  }

  if (processed.faqcontent && Array.isArray(processed.faqcontent)) {
    processed.faqcontent = processed.faqcontent.map(faq => {
      if (faq.answerHtml) {
        const result = applyGrammarFixes(faq.answerHtml);
        totalFixes += result.fixCount;
        return { ...faq, answerHtml: result.text };
      }
      return faq;
    });
  }

  return { entry: processed, fixCount: totalFixes };
}

async function main() {
  const inputFile = process.argv[2] || 'data/content/master/successes-rewritten.jsonl';
  const outputFile = process.argv[3] || 'data/content/master/successes-rewritten-grammar-fixed.jsonl';

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('GRAMMAR CLEANUP SCRIPT (Conservative)');
  console.log('='.repeat(60));
  console.log(`Input:  ${inputFile}`);
  console.log(`Output: ${outputFile}`);
  console.log('');
  console.log('This script ONLY fixes:');
  console.log('  - Broken placeholder artefacts (the it, the this, etc.)');
  console.log('  - Basic spacing/punctuation issues');
  console.log('  - Double word patterns');
  console.log('');
  console.log('It does NOT inject specific nouns or change meaning.');
  console.log('');

  const outputStream = fs.createWriteStream(outputFile);
  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let processed = 0;
  let totalFixes = 0;
  let entriesWithFixes = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);
      const { entry: fixed, fixCount } = processEntry(entry);

      outputStream.write(JSON.stringify(fixed) + '\n');

      processed++;
      totalFixes += fixCount;
      if (fixCount > 0) entriesWithFixes++;

      if (processed % 1000 === 0) {
        console.log(`Processed ${processed} entries, ${totalFixes} fixes applied...`);
      }
    } catch (err) {
      console.error(`Error on line ${processed + 1}: ${err.message}`);
    }
  }

  outputStream.end();

  const elapsed = (Date.now() - startTime) / 1000;

  console.log('');
  console.log('='.repeat(60));
  console.log('GRAMMAR CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total entries processed: ${processed}`);
  console.log(`Entries with fixes:      ${entriesWithFixes}`);
  console.log(`Total fixes applied:     ${totalFixes}`);
  console.log(`Time elapsed:            ${elapsed.toFixed(1)}s`);
  console.log('');
  console.log(`Output file: ${outputFile}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
