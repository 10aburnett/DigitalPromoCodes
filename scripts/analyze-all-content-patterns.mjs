#!/usr/bin/env node
/**
 * Analyzes ALL content fields in JSONL for repetitive patterns
 * Checks: aboutcontent, faqcontent, howtoredeemcontent, promodetailscontent, termscontent
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/raw/ai-run-20251104T180924.fixed.jsonl';

// Extract patterns from content
function extractPatterns(content, type) {
  if (!content || typeof content !== 'string') return [];

  const patterns = [];

  // Extract opening sentences (first sentence of each paragraph)
  const openingMatches = content.match(/<p>([^.!?]+[.!?])/g) || [];
  openingMatches.forEach(m => {
    const clean = m.replace(/<[^>]+>/g, '').trim();
    if (clean.length > 20) {
      patterns.push({ type: `${type}_opening`, text: clean.slice(0, 80) });
    }
  });

  // Extract closing sentences (last sentence before </p>)
  const closingMatches = content.match(/([^.!?]+[.!?])\s*<\/p>/g) || [];
  closingMatches.forEach(m => {
    const clean = m.replace(/<[^>]+>/g, '').trim();
    if (clean.length > 20) {
      patterns.push({ type: `${type}_closing`, text: clean.slice(0, 80) });
    }
  });

  return patterns;
}

// Extract FAQ patterns
function extractFAQPatterns(faqcontent) {
  if (!faqcontent) return [];

  const patterns = [];

  // Handle array of FAQ objects
  if (Array.isArray(faqcontent)) {
    for (const faq of faqcontent) {
      if (faq.question) {
        const firstWords = faq.question.split(' ').slice(0, 4).join(' ');
        patterns.push({ type: 'faq_question_start', text: firstWords });
      }
      if (faq.answer) {
        // Get first sentence of answer
        const firstSentence = faq.answer.match(/^([^.!?]+[.!?])/);
        if (firstSentence && firstSentence[1].length > 15) {
          patterns.push({ type: 'faq_answer_opening', text: firstSentence[1].slice(0, 60) });
        }
      }
    }
    return patterns;
  }

  // Handle string format (HTML)
  if (typeof faqcontent === 'string') {
    // Extract question starts
    const questions = faqcontent.match(/<h3>([^<]+)<\/h3>/g) || [];
    questions.forEach(q => {
      const clean = q.replace(/<[^>]+>/g, '').trim();
      // Get first few words as pattern
      const firstWords = clean.split(' ').slice(0, 4).join(' ');
      patterns.push({ type: 'faq_question_start', text: firstWords });
    });

    // Extract answer openings
    const answers = faqcontent.match(/<p>([^.!?]+[.!?])/g) || [];
    answers.forEach(a => {
      const clean = a.replace(/<[^>]+>/g, '').trim();
      if (clean.length > 15) {
        patterns.push({ type: 'faq_answer_opening', text: clean.slice(0, 60) });
      }
    });
  }

  return patterns;
}

// Extract how-to-redeem step patterns
function extractHowToPatterns(howtoredeemcontent) {
  if (!howtoredeemcontent) return [];

  const patterns = [];

  // Handle array format
  if (Array.isArray(howtoredeemcontent)) {
    for (const step of howtoredeemcontent) {
      if (typeof step === 'string') {
        const firstWords = step.split(' ').slice(0, 5).join(' ');
        patterns.push({ type: 'howto_step', text: firstWords });
      }
    }
    return patterns;
  }

  // Handle string/HTML format
  if (typeof howtoredeemcontent === 'string') {
    const items = howtoredeemcontent.match(/<li>([^<]+)<\/li>/g) || [];
    items.forEach(item => {
      const clean = item.replace(/<[^>]+>/g, '').trim();
      const firstWords = clean.split(' ').slice(0, 5).join(' ');
      patterns.push({ type: 'howto_step', text: firstWords });
    });
  }

  return patterns;
}

// Extract promo details patterns
function extractPromoDetailsPatterns(promodetailscontent) {
  if (!promodetailscontent) return [];

  const patterns = [];

  // Handle array format
  if (Array.isArray(promodetailscontent)) {
    for (const item of promodetailscontent) {
      if (typeof item === 'string') {
        const firstWords = item.split(' ').slice(0, 4).join(' ');
        patterns.push({ type: 'promodetails_item', text: firstWords });
      }
    }
    return patterns;
  }

  // Handle string/HTML format
  if (typeof promodetailscontent === 'string') {
    const items = promodetailscontent.match(/<li>([^<]+)<\/li>/g) || [];
    items.forEach(item => {
      const clean = item.replace(/<[^>]+>/g, '').trim();
      const firstWords = clean.split(' ').slice(0, 4).join(' ');
      patterns.push({ type: 'promodetails_item', text: firstWords });
    });
  }

  return patterns;
}

function main() {
  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  console.log(`Analyzing ${lines.length} entries from ${INPUT_FILE}\n`);

  // Collect all patterns
  const patternCounts = new Map();
  const patternExamples = new Map();

  for (const line of lines) {
    const obj = JSON.parse(line);
    const slug = obj.slug;

    // Analyze each content field
    const allPatterns = [
      ...extractPatterns(obj.aboutcontent, 'about'),
      ...extractFAQPatterns(obj.faqcontent),
      ...extractHowToPatterns(obj.howtoredeemcontent),
      ...extractPromoDetailsPatterns(obj.promodetailscontent),
      ...extractPatterns(obj.termscontent, 'terms'),
    ];

    for (const p of allPatterns) {
      const key = `${p.type}|||${p.text}`;
      patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
      if (!patternExamples.has(key)) {
        patternExamples.set(key, slug);
      }
    }
  }

  // Find duplicates (patterns appearing 3+ times)
  console.log('=== REPEATED PATTERNS (3+ occurrences) ===\n');

  const duplicates = [];
  for (const [key, count] of patternCounts) {
    if (count >= 3) {
      const [type, text] = key.split('|||');
      duplicates.push({ type, text, count, example: patternExamples.get(key) });
    }
  }

  // Sort by count descending
  duplicates.sort((a, b) => b.count - a.count);

  // Group by type
  const byType = new Map();
  for (const d of duplicates) {
    if (!byType.has(d.type)) byType.set(d.type, []);
    byType.get(d.type).push(d);
  }

  for (const [type, items] of byType) {
    console.log(`\n--- ${type.toUpperCase()} ---`);
    for (const item of items.slice(0, 10)) {
      console.log(`  ${item.count}x: "${item.text}..."`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total unique patterns: ${patternCounts.size}`);
  console.log(`Patterns appearing 3+ times: ${duplicates.length}`);
  console.log(`Patterns appearing 5+ times: ${duplicates.filter(d => d.count >= 5).length}`);
  console.log(`Patterns appearing 10+ times: ${duplicates.filter(d => d.count >= 10).length}`);

  // Output JSON for fixing
  const toFix = duplicates.filter(d => d.count >= 5);
  if (toFix.length > 0) {
    const outputFile = INPUT_FILE.replace('.jsonl', '.patterns.json');
    fs.writeFileSync(outputFile, JSON.stringify(toFix, null, 2));
    console.log(`\nPatterns to fix saved to: ${outputFile}`);
  }
}

main();
