#!/usr/bin/env node
/**
 * Comprehensive post-processor to fix ALL repetitive patterns across content fields
 * Uses OpenAI to rewrite repeated FAQ questions, how-to steps, promo details, and closings
 */

import fs from 'fs';

const INPUT_FILE = process.argv[2] || 'data/content/raw/ai-run-20251104T180924.fixed.jsonl';
const OUTPUT_FILE = INPUT_FILE.replace('.jsonl', '.deduped.jsonl');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Track already used phrases to ensure uniqueness
const usedPhrases = {
  faqQuestions: new Map(),
  howtoSteps: new Map(),
  promoDetails: new Map(),
  closings: new Set(),
};

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
      max_tokens: 150,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Vary FAQ questions
async function varyFAQQuestion(question, productName, existingVariations) {
  const questionStart = question.split(' ').slice(0, 4).join(' ');

  // Only vary if this exact start appears 3+ times
  const count = usedPhrases.faqQuestions.get(questionStart) || 0;
  if (count < 3) {
    usedPhrases.faqQuestions.set(questionStart, count + 1);
    return question;
  }

  const prompt = `Slightly rephrase this FAQ question (SAME MEANING, just different words):

ORIGINAL: "${question}"

Rules:
- Keep EXACT same meaning and topic
- Only swap a few words for synonyms
- Examples: "How do I" → "What's the process to", "Is there" → "Are there any", "Can I get" → "Is it possible to get"

Return ONLY the rephrased question (no quotes).`;

  try {
    const newQ = await callOpenAI(prompt);
    return newQ.replace(/^["']|["']$/g, '');
  } catch (e) {
    return question;
  }
}

// Vary how-to steps
async function varyHowToStep(step, productName, stepNumber) {
  const stepStart = step.split(' ').slice(0, 5).join(' ');

  const count = usedPhrases.howtoSteps.get(stepStart) || 0;
  // Much more aggressive - trigger after just 2 uses
  if (count < 2) {
    usedPhrases.howtoSteps.set(stepStart, count + 1);
    return step;
  }

  const prompt = `Slightly rephrase this step (SAME MEANING, just different words):

ORIGINAL: "${step}"

Rules:
- Keep EXACT same meaning and information
- Only swap a few words for synonyms
- Keep same length
- Examples: "Visit" → "Go to", "Select" → "Choose", "Review" → "Check"

Return ONLY the rephrased step (no quotes).`;

  try {
    const newStep = await callOpenAI(prompt);
    return newStep.replace(/^["']|["']$/g, '').replace(/^\d+\.\s*/, '');
  } catch (e) {
    return step;
  }
}

// Vary promo detail bullets
async function varyPromoDetail(detail, productName) {
  const detailStart = detail.split(' ').slice(0, 4).join(' ');

  const count = usedPhrases.promoDetails.get(detailStart) || 0;
  if (count < 3) {
    usedPhrases.promoDetails.set(detailStart, count + 1);
    return detail;
  }

  const prompt = `Slightly rephrase this bullet point (SAME MEANING, just different words):

ORIGINAL: "${detail}"

Rules:
- Keep EXACT same meaning and information
- Only swap a few words for synonyms
- Keep same length

Return ONLY the rephrased bullet (no quotes).`;

  try {
    const newDetail = await callOpenAI(prompt);
    return newDetail.replace(/^["']|["']$/g, '').replace(/^[-•]\s*/, '');
  } catch (e) {
    return detail;
  }
}

// Vary closing sentences
async function varyClosing(content, productName) {
  // Extract last sentence before final </p>
  const closingMatch = content.match(/([^.!?]+[.!?])\s*<\/p>\s*$/);
  if (!closingMatch) return content;

  const closing = closingMatch[1].trim();

  if (usedPhrases.closings.has(closing)) {
    const prompt = `Slightly rephrase this closing sentence (SAME MEANING, just different words):

ORIGINAL: "${closing}"

Rules:
- Keep EXACT same meaning
- Only swap a few words for synonyms
- Keep same length

Return ONLY the rephrased sentence (no quotes).`;

    try {
      const newClosing = await callOpenAI(prompt);
      const cleanClosing = newClosing.replace(/^["']|["']$/g, '');
      usedPhrases.closings.add(cleanClosing);
      return content.replace(/([^.!?]+[.!?])\s*<\/p>\s*$/, `${cleanClosing}</p>`);
    } catch (e) {
      return content;
    }
  }

  usedPhrases.closings.add(closing);
  return content;
}

async function processEntry(obj, index, total) {
  const name = obj.name || obj.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let modified = false;
  let changes = [];

  // 1. Vary FAQ questions
  if (Array.isArray(obj.faqcontent)) {
    const newFaqs = [];
    for (const faq of obj.faqcontent) {
      if (faq.question) {
        const newQ = await varyFAQQuestion(faq.question, name, newFaqs.map(f => f.question));
        if (newQ !== faq.question) {
          changes.push('faq');
          modified = true;
        }
        newFaqs.push({ ...faq, question: newQ });
      } else {
        newFaqs.push(faq);
      }
    }
    obj.faqcontent = newFaqs;
  }

  // 2. Vary how-to steps (HTML string with <li> items)
  if (typeof obj.howtoredeemcontent === 'string' && obj.howtoredeemcontent.includes('<li>')) {
    let html = obj.howtoredeemcontent;
    const liItems = html.match(/<li>([^<]+)<\/li>/g) || [];
    let stepNum = 0;
    for (const liItem of liItems) {
      const text = liItem.replace(/<\/?li>/g, '');
      stepNum++;
      const newText = await varyHowToStep(text, name, stepNum);
      if (newText !== text) {
        html = html.replace(`<li>${text}</li>`, `<li>${newText}</li>`);
        changes.push('howto');
        modified = true;
      }
    }
    obj.howtoredeemcontent = html;
  }

  // 3. Vary promo details (HTML string with <li> items)
  if (typeof obj.promodetailscontent === 'string' && obj.promodetailscontent.includes('<li>')) {
    let html = obj.promodetailscontent;
    const liItems = html.match(/<li>([^<]+)<\/li>/g) || [];
    for (const liItem of liItems) {
      const text = liItem.replace(/<\/?li>/g, '');
      const newText = await varyPromoDetail(text, name);
      if (newText !== text) {
        html = html.replace(`<li>${text}</li>`, `<li>${newText}</li>`);
        changes.push('promo');
        modified = true;
      }
    }
    obj.promodetailscontent = html;
  }

  // 4. Vary aboutcontent closing
  if (typeof obj.aboutcontent === 'string') {
    const newAbout = await varyClosing(obj.aboutcontent, name);
    if (newAbout !== obj.aboutcontent) {
      changes.push('closing');
      modified = true;
    }
    obj.aboutcontent = newAbout;
  }

  if (modified) {
    console.log(`  [${index + 1}/${total}] ${obj.slug}: ${changes.join(', ')}`);
  }

  return obj;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const lines = fs.readFileSync(INPUT_FILE, 'utf8').trim().split('\n');
  console.log(`Processing ${lines.length} entries from ${INPUT_FILE}\n`);

  const entries = lines.map(line => JSON.parse(line));
  const processed = [];

  for (let i = 0; i < entries.length; i++) {
    const result = await processEntry(entries[i], i, entries.length);
    processed.push(result);

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Write output
  const output = processed.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`\nDone! Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
