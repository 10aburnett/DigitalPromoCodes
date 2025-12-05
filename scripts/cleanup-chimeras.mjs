import fs from 'fs';
import readline from 'readline';

const INPUT = 'data/content/master/successes-PUBLISH-READY-v2.jsonl';
const OUTPUT = 'data/content/master/successes-PUBLISH-READY-v3.jsonl';

// Patterns for remaining chimeras and broken sentences
const CLEANUP_PATTERNS = [
  // Triple/double repetitions
  /offers ongoing support offers ongoing support offers ongoing support/gi,
  /offers ongoing support offers ongoing support/gi,

  // Chimera patterns with 'includes/delivers/provides to that'
  /The methodology includes to that, the platform includes ongoing support\.?\s*/gi,
  /This includes to that, the platform delivers ongoing support\.?\s*/gi,
  /Includes to that, the platform provides ongoing support\.?\s*/gi,
  /What's more, the platform includes ongoing support\.?\s*/gi,
  /Beyond that, the platform provides ongoing support\.?\s*/gi,
  /Additionally to that, the platform delivers ongoing support\.?\s*/gi,
  /This means to that, the platform delivers ongoing support\.?\s*/gi,

  // Generic 'X to that, the platform Y ongoing support' pattern
  /[A-Za-z]+\s+to that,\s*the platform\s+(includes|delivers|provides)\s+ongoing support\.?\s*/gi,

  // Standalone 'the platform X ongoing support' fillers as sentences
  /\.\s*The platform also offers ongoing support\.?\s*/gi,
  /\.\s*The platform (includes|delivers|provides) ongoing support\.?\s*/gi,

  // Broken 'it!' and 'it.' patterns
  /\bit!\s+provides\b/gi,
  /\bit\.\s+provides\b/gi,

  // 'it is available here.' orphaned filler
  /\bit is available here\.?\s*/gi
];

function cleanBrokenPatterns(text) {
  if (!text) return text;
  let cleaned = text;
  for (const pat of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pat, match => {
      // If pattern starts with '. ', preserve the period
      if (match.startsWith('. ')) return '. ';
      return '';
    });
  }
  // Clean up double spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  // Clean up empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
  return cleaned;
}

async function main() {
  const rl = readline.createInterface({ input: fs.createReadStream(INPUT) });
  const out = fs.createWriteStream(OUTPUT);
  let count = 0;
  let fixes = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    const original = JSON.stringify(obj);

    // Clean all HTML fields
    for (const field of ['aboutcontent', 'howtoredeemcontent', 'promodetailscontent', 'termscontent']) {
      if (obj[field]) {
        obj[field] = cleanBrokenPatterns(obj[field]);
      }
    }

    // Clean FAQ answers
    if (obj.faqcontent && Array.isArray(obj.faqcontent)) {
      for (const faq of obj.faqcontent) {
        if (faq.answer) {
          faq.answer = cleanBrokenPatterns(faq.answer);
        }
        if (faq.answerHtml) {
          faq.answerHtml = cleanBrokenPatterns(faq.answerHtml);
        }
      }
    }

    if (JSON.stringify(obj) !== original) fixes++;
    out.write(JSON.stringify(obj) + '\n');
    count++;
  }

  out.end();
  console.log('Processed:', count, 'entries');
  console.log('Fixed:', fixes, 'entries with broken patterns');
}

main();
