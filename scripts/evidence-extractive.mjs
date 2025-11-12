// scripts/evidence-extractive.mjs
// Extractive, bilingual, zero-hallucination evidence processing

import { franc } from 'franc-min';

// Rough sentence extraction (60-240 chars ending in punctuation)
const SENT_RX = /([^.!?]{60,240}[.!?])/g;

/**
 * Detect language using franc (returns 'fr' or 'en')
 */
export function detectLang(text) {
  try {
    const code = franc((text || '').slice(0, 4000));
    return code === 'fra' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Extract salient sentences as quote bank (de-duped, prioritized)
 * @param {string} text - Raw evidence text (HTML or plain text)
 * @param {number} max - Maximum quotes to return (default 12)
 * @returns {string[]} Array of quote sentences
 */
export function makeQuoteBank(text, max = 12) {
  // Remove script/style tags if HTML is passed
  const cleaned = (text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const seen = new Set();
  const sents = (cleaned.match(SENT_RX) || [])
    .map(s => {
      // Strip HTML tags and collapse whitespace
      const stripped = s.replace(/<\/?[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return stripped;
    })
    .filter(s => s.length >= 80 && s.length <= 220)
    .filter(s => {
      // Filter out sentences with JSON/code/URL artifacts
      if (/[{}\[\]"]/.test(s)) return false;
      if (/data-radix|class=|href=|rel=|src=/.test(s)) return false;
      if (/https?:|\.com\/|\.net\/|api\/|amazonaws|cloudflare/i.test(s)) return false;
      if (/width:|height:|resize:|plain\/https/i.test(s)) return false;
      if (/%2F|%20|%3D|%3F|%26/i.test(s)) return false; // URL encoding
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });

  // Prioritize sentences containing relevant keywords
  const priority = s => (
    /\b(access|discord|support|pricing|price|plan|abonnement|accès|tarif|essai|bot|signal|indicateur|trading|crypto|cours|formation|mentorship|community|membre|premium|vip)\b/i.test(s) ? 1 : 0
  );

  return sents
    .sort((a, b) => priority(b) - priority(a) || b.length - a.length)
    .slice(0, max);
}

/**
 * Extract neutral feature phrases from evidence text
 * @param {string} text - Raw evidence text
 * @returns {string[]} Array of feature phrases (max 4)
 */
export function extractFeaturePhrases(text) {
  const hits = [];
  const add = t => { if (!hits.includes(t)) hits.push(t); };
  const lower = (text || '').toLowerCase();

  if (/\bdiscord\b/.test(lower)) add('Discord access');
  if (/\bbot(ting)?\b/.test(lower)) add('automation/bot usage');
  if (/\bsignal(s)?\b/.test(lower) || /\bindicator\b/.test(lower) || /\bindicateur\b/.test(lower)) {
    add('trading signals/indicator');
  }
  if (/\babonnement|subscription|plan\b/.test(lower)) add('subscription/plan based access');
  if (/\bessai|free trial\b/.test(lower)) add('trial or limited access window');
  if (/\bsupport|assistance\b/.test(lower)) add('creator/Whop support channel');
  if (/\bcommunity|communauté|groupe|group\b/.test(lower)) add('community/group access');
  if (/\bformation|course|training|mentorship\b/.test(lower)) add('educational/training content');
  if (/\btrading|crypto|forex|stocks|options\b/.test(lower)) add('trading/investment focus');

  return hits.slice(0, 4);
}
