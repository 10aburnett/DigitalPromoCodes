#!/usr/bin/env node
/**
 * Post-processor to fix repetitive opening patterns in aboutcontent
 * Only rewrites the first sentence, preserving the rest of the content
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/raw/ai-run-20251104T180924.jsonl';
const OUTPUT_FILE = INPUT_FILE.replace('.jsonl', '.fixed.jsonl');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Patterns to detect and fix
const REPETITIVE_PATTERNS = [
  /^<p>Breaking into [^.]+can feel overwhelming\./i,
  /^<p>[^<]+ promo code is available here/i,
  /^<p>Looking to [^?]+\?/i,
  /^<p>Unlock [^.]+savings/i,
  /^<p>Want to [^?]+\?/i,
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
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function detectPattern(aboutcontent) {
  for (const pattern of REPETITIVE_PATTERNS) {
    if (pattern.test(aboutcontent)) {
      return pattern.source;
    }
  }
  return null;
}

function extractFirstSentence(aboutcontent) {
  const match = aboutcontent.match(/^<p>([^.!?]+[.!?])/);
  return match ? match[1] : null;
}

async function rewriteOpening(slug, name, aboutcontent, existingOpenings) {
  const firstSentence = extractFirstSentence(aboutcontent);
  if (!firstSentence) return { fixed: aboutcontent, newOpening: null };

  const prompt = `Rewrite ONLY this opening sentence for a promo code page about "${name}":

CURRENT: "${firstSentence}"

REQUIREMENTS:
- Must include "${name} promo code" somewhere in the sentence
- Must be completely different structure from these already-used openings:
${existingOpenings.slice(-10).map(o => `  - "${o}"`).join('\n')}

BANNED patterns (do NOT use):
- "Breaking into X can feel overwhelming"
- "[Name] promo code is available here"
- "Looking to X?"
- "Want to X?"
- "Unlock savings with"

GOOD alternatives:
- Start with a fact about the product
- Start with the creator's credentials
- Start with what makes it unique
- Start with a specific benefit
- Start with the target audience

Return ONLY the new opening sentence (no quotes, no explanation).`;

  try {
    const newOpening = await callOpenAI(prompt);

    // Replace first sentence with new one
    const fixed = aboutcontent.replace(
      /^<p>[^.!?]+[.!?]/,
      `<p>${newOpening}`
    );

    return { fixed, newOpening };
  } catch (err) {
    console.error(`Error rewriting ${slug}:`, err.message);
    return { fixed: aboutcontent, newOpening: firstSentence };
  }
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  console.log(`Loaded ${lines.length} entries from ${INPUT_FILE}`);

  // First pass: detect patterns and count
  const patternCounts = new Map();
  const entries = lines.map(line => {
    const obj = JSON.parse(line);
    const pattern = detectPattern(obj.aboutcontent || '');
    if (pattern) {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }
    return { obj, pattern, needsFix: false };
  });

  // Mark entries that need fixing (pattern used more than twice)
  for (const entry of entries) {
    if (entry.pattern && patternCounts.get(entry.pattern) > 2) {
      entry.needsFix = true;
    }
  }

  const toFix = entries.filter(e => e.needsFix);
  console.log(`\nPattern analysis:`);
  for (const [pattern, count] of patternCounts) {
    console.log(`  ${count}x: ${pattern.slice(0, 60)}...`);
  }
  console.log(`\nNeed to fix: ${toFix.length} entries`);

  if (toFix.length === 0) {
    console.log('No fixes needed!');
    fs.copyFileSync(INPUT_FILE, OUTPUT_FILE);
    return;
  }

  // Second pass: rewrite problematic openings
  const existingOpenings = [];
  let fixed = 0;

  for (const entry of entries) {
    if (entry.needsFix) {
      const { obj } = entry;
      const name = obj.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      console.log(`Fixing: ${obj.slug}`);

      const result = await rewriteOpening(obj.slug, name, obj.aboutcontent, existingOpenings);

      obj.aboutcontent = result.fixed;
      if (result.newOpening) existingOpenings.push(result.newOpening);
      fixed++;

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    } else {
      const first = extractFirstSentence(entry.obj.aboutcontent);
      if (first) existingOpenings.push(first);
    }
  }

  // Write output
  const output = entries.map(e => JSON.stringify(e.obj)).join('\n') + '\n';
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`\nDone! Fixed ${fixed} entries`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
