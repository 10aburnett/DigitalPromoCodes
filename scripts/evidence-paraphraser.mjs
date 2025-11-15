// scripts/evidence-paraphraser.mjs
// LLM-based paraphrasing of evidence for validator-safe content generation

/**
 * Robust type-safe string converter
 * Handles all possible API response shapes
 */
function ensureString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(ensureString).join(" ");
  }
  if (typeof value === "object") {
    // Common OpenAI-style shapes
    if (value.content && typeof value.content === "string") return value.content;
    if (value.text && typeof value.text === "string") return value.text;
    if (value.message && typeof value.message.content === "string") {
      return value.message.content;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Build paraphrased content from evidence using a single LLM call
 * @param {Object} params
 * @param {Object} params.api - API instance with callLLM method
 * @param {string} params.slug - Product slug
 * @param {string} params.name - Product display name
 * @param {string} params.host - Evidence source hostname
 * @param {Object} params.evidence - Evidence object with visibleText
 * @param {Function} [params.normaliseOutput] - Optional word count clamping function
 * @returns {Promise<Object>} Content payload (aboutcontent, howtoredeemcontent, etc.)
 */
export async function buildParaphrasedFromEvidence({ api, slug, name, host, evidence, normaliseOutput }) {
  // 1. Extract visibleText (clean, human-readable text - NOT raw HTML!)
  const visible = evidence.visibleText || evidence.textSample || "";
  const lang = evidence.lang || "en";

  // 2. Ensure we have enough text to paraphrase (relaxed threshold to ~320)
  if (visible.length < 320) {
    throw new Error(`Insufficient visibleText for paraphrasing (${visible.length} chars)`);
  }

  // 3. Build SYSTEM prompt (strict guardrails)
  const systemPrompt = `You are a precise content paraphraser. Your task:

1. Read the provided evidence text from a Whop marketplace page
2. Generate validator-compliant content in English only
3. NEVER hallucinate details not in the evidence
4. If evidence is in French or other languages, translate to English
5. Maintain neutral, factual tone
6. Follow exact word count and structure requirements

Output ONLY valid JSON with these fields:
- aboutcontent: 2 paragraphs (130-150 words total)
- howtoredeemcontent: 5 numbered steps (10-16 words each)
- promodetailscontent: 5-7 bullets (facts from evidence)
- termscontent: 5 bullets (generic terms)
- faqcontent: array of 5 objects with {question, answerHtml}

CRITICAL: Output must be JSON only, no markdown fences, no explanations.`;

  // 4. Build USER prompt (evidence + requirements)
  const userPrompt = `Product: ${name}
Slug: ${slug}
Evidence Source: ${host}
Language Detected: ${lang}

EVIDENCE TEXT (human-visible content from page):
"""
${visible.slice(0, 8000)}
"""

Generate JSON content following these rules:

ABOUT CONTENT (2 paragraphs, 130-150 words):
- P1: Neutral intro mentioning "${name} promo code is available here"
- P2: Paraphrase key points from evidence (what the page says about access, features, plans)

HOW TO REDEEM (5 steps, 10-16 words each):
1. Open official Whop listing and sign in or create account
2. Review description, plan details, and creator terms before purchase
3. Choose a plan that fits your needs and proceed to checkout
4. Confirm payment and any account verification requested
5. Access dashboard and follow creator instructions to begin using features

PROMO DETAILS (5-7 bullets):
- 3-4 generic bullets about Whop access, terms, fees
- 2-3 bullets paraphrased from evidence (e.g., "The page mentions Discord access", "References trading signals")

TERMS (5 bullets, generic):
- Subject to Whop Terms of Service and creator policy
- Misuse or policy violations can result in access revocation
- Refunds, if any, follow the creator or Whop policy
- Comply with applicable laws and platform rules when using
- Review renewal and cancellation terms before purchase

FAQ (5 items):
1. What is ${name}? [Paraphrase from evidence]
2. How do I redeem access? [Generic Whop instructions]
3. Is there a discount available? [Reference current offer if mentioned]
4. Can I get a refund? [Generic refund policy]
5. Who provides support? [Mention if evidence references support channel]

Each FAQ answer should be 1-2 sentences in <p> tags.

Output ONLY the JSON object, no markdown code fences.`;

  // 5. Call LLM once with combined prompt (callLLM expects a string)
  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const rawResponse = await api.callLLM(combinedPrompt);

  // 6. Normalize to a string BEFORE doing any .replace()
  const responseStr = ensureString(rawResponse);

  let parsed;
  try {
    // Remove markdown fences if present
    const cleaned = responseStr
      .replace(/```json[\r\n]*/gi, "")
      .replace(/```[\r\n]*/g, "")
      .trim();

    parsed = JSON.parse(cleaned);
  } catch (err) {
    const preview = responseStr.slice(0, 500);
    throw new Error(
      `Failed to parse LLM JSON response: ${err.message}\nResponse preview: ${preview}`
    );
  }

  // 7. Validate required fields
  const required = ['aboutcontent', 'howtoredeemcontent', 'promodetailscontent', 'termscontent', 'faqcontent'];
  for (const field of required) {
    if (!parsed[field]) {
      throw new Error(`Missing required field in LLM response: ${field}`);
    }
  }

  // 8. Ensure all HTML content fields are strings before normalizeOutput
  // This prevents "html.replace is not a function" errors in downstream processing
  parsed.aboutcontent = ensureString(parsed.aboutcontent);
  parsed.howtoredeemcontent = ensureString(parsed.howtoredeemcontent);
  parsed.promodetailscontent = ensureString(parsed.promodetailscontent);
  parsed.termscontent = ensureString(parsed.termscontent);

  // Ensure FAQ array items have string fields
  if (Array.isArray(parsed.faqcontent)) {
    parsed.faqcontent = parsed.faqcontent.map(item => ({
      question: ensureString(item?.question || ""),
      answerHtml: ensureString(item?.answerHtml || item?.answer || "")
    }));
  }

  // 9. Normalize word counts using provided function, if present
  let normalized;
  if (typeof normaliseOutput === "function") {
    normalized = normaliseOutput(parsed);
  } else {
    // Fallback: just return the parsed, cleaned object as-is
    normalized = parsed;
  }

  return normalized;
}
