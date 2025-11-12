// FAQ grounding validators and regenerators

function hasQuoteAndHost(html, host) {
  const hasQuote = /"[^"]{10,}"|\"[^"]{10,}\"|<q>[^<]{10,}<\/q>/i.test(html || "");
  const escHost = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasHost = new RegExp(`\\(Verified on\\s+${escHost}\\)`, "i").test(html || "");
  return hasQuote && hasHost;
}

export function faqIsGrounded(faq, evText, host) {
  if (!Array.isArray(faq) || faq.length === 0) return false;
  const snippet = (s) => String(s || "").replace(/<[^>]+>/g, " ");
  return faq.every(x => x?.answerHtml && hasQuoteAndHost(x.answerHtml, host)
    && snippet(evText).toLowerCase().includes( snippet(x.answerHtml).slice(0, 30).toLowerCase() ));
}

export async function regenerateFaqGrounded(callJSON, evidenceHtml, host) {
  const ev = evidenceHtml.replace(/<script[\s\S]*?<\/script>/ig,"")
                         .replace(/<style[\s\S]*?<\/style>/ig,"")
                         .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const sys = `Answer FAQs using ONLY this evidence. Each answer MUST include one verbatim quoted sentence and end with "(Verified on ${host})". Keep each answer to 1–2 short sentences. If missing, write exactly: "We couldn't verify this from the available sources."`;
  const user = `EVIDENCE:\n${ev}\n\nReturn 4–5 items as JSON array like:\n[{ "question":"...", "answerHtml":"<p>\"quoted sentence from evidence.\" (Verified on ${host})</p>" }]`;
  return await callJSON(sys, user);
}

export function buildQuoteOnlyFaq(evidenceText, host) {
  const sents = (evidenceText.match(/[^.?!]{40,}[.?!]/g) || []).slice(0,6);
  const items = [];

  // 1) Use up to 3 evidence quotes
  for (let i = 0; i < Math.min(3, sents.length); i++) {
    items.push({
      question: ["What we can verify", "What the source confirms", "Evidence summary"][i] || "What we can verify",
      answerHtml: `<p>"${sents[i].trim()}" (Verified on ${host})</p>`
    });
  }

  // 2) Pad to ≥4 with safe, non-inventive items
  while (items.length < 4) {
    items.push({
      question: items.length === 0 ? "Are details verified?" : "Will this page be updated?",
      answerHtml: items.length === 0
        ? `<p>We couldn't verify this from the available sources.</p>`
        : `<p>Yes—once we verify details from official sources.</p>`
    });
  }

  // 3) Limit to 5 items max for token economy
  return items.slice(0,5);
}

// -----------------------------------------------------------------------------
// LARGE GENERIC FAQ BANK (neutral, safe, platform-agnostic; never uses "promo code")
// -----------------------------------------------------------------------------

export const FAQ_BANK = [
  // DISCOVERY & OFFERS
  { cat: "discovery", question: "How do discounts generally work for this creator?",
    answerHtml: `<p>Creators sometimes run time-limited discounts or bundles. Exact availability varies and may change without notice.</p>` },
  { cat: "discovery", question: "Where can I find the latest discount or offer?",
    answerHtml: `<p>Check the creator's official page and social channels for any current offers. If nothing is listed, standard pricing typically applies.</p>` },
  { cat: "discovery", question: "Do creators announce new deals in advance?",
    answerHtml: `<p>Not always. Many offers launch without advance notice. Monitoring the official page is the most reliable approach.</p>` },
  { cat: "discovery", question: "Are there bundle or multi-month deals?",
    answerHtml: `<p>Some creators provide bundles or multi-month options. When available, they are usually shown on the product or checkout page.</p>` },

  // REDEMPTION
  { cat: "redeem", question: "How do I redeem a discount during checkout?",
    answerHtml: `<p>On the checkout page, look for a field to add a discount. Enter it exactly, apply, and verify the updated total before paying.</p>` },
  { cat: "redeem", question: "Why doesn't a discount apply at checkout?",
    answerHtml: `<p>Offers may expire, have eligibility rules, or require minimum spend. Refresh the page, confirm terms, and try again if needed.</p>` },
  { cat: "redeem", question: "Can I stack multiple discounts?",
    answerHtml: `<p>Typically only one discount is allowed per order. If stacking is supported, it will be clearly indicated during checkout.</p>` },

  // BILLING & PRICING
  { cat: "billing", question: "When will I be charged?",
    answerHtml: `<p>You are charged when you confirm the purchase. For subscriptions, future renewal dates are usually shown at checkout or in your account.</p>` },
  { cat: "billing", question: "Do prices change over time?",
    answerHtml: `<p>Prices can change at a creator's discretion. Always review the final total at checkout before confirming payment.</p>` },
  { cat: "billing", question: "Is there a trial or introductory rate?",
    answerHtml: `<p>Some creators offer trials or introductory pricing. If available, details appear on the product page or during checkout.</p>` },

  // REFUNDS & CANCELLATIONS
  { cat: "refunds", question: "What is the refund policy?",
    answerHtml: `<p>Refund policies vary by creator. Look for a refund section on the creator's page or contact them directly for clarification.</p>` },
  { cat: "refunds", question: "How do I request a refund or cancellation?",
    answerHtml: `<p>Use the support link on the creator's page to request a refund or cancel. Provide your order details for faster review.</p>` },
  { cat: "refunds", question: "Are refunds guaranteed for digital products?",
    answerHtml: `<p>Digital products often have specific eligibility rules. Review the policy on the creator's page before purchasing.</p>` },

  // ACCOUNT & ACCESS
  { cat: "account", question: "How do I access the content after purchase?",
    answerHtml: `<p>After payment, you'll receive access instructions in your account or via email. Follow those steps to get started.</p>` },
  { cat: "account", question: "I didn't receive an access email — what should I do?",
    answerHtml: `<p>Check spam/junk folders and ensure you used the correct email. If still missing, contact the creator's support.</p>` },
  { cat: "account", question: "Can I change the email on my order?",
    answerHtml: `<p>In many cases, you can update your email through account settings or by contacting support with order verification.</p>` },

  // RENEWALS & SUBSCRIPTIONS
  { cat: "renewals", question: "Does this subscription renew automatically?",
    answerHtml: `<p>Many subscriptions renew automatically unless cancelled. Renewal timing and price are usually shown at checkout and in your account.</p>` },
  { cat: "renewals", question: "How do I turn off auto-renewal?",
    answerHtml: `<p>Go to your account or billing settings and disable auto-renewal before the next charge date.</p>` },
  { cat: "renewals", question: "Will I get a notice before renewal?",
    answerHtml: `<p>Some services send reminders; others don't. Check your account settings and saved email address for notifications.</p>` },

  // TROUBLESHOOTING
  { cat: "troubleshoot", question: "My payment failed — what can I try?",
    answerHtml: `<p>Confirm card details, enable 3-D Secure if prompted, and try a different browser or card. Contact your bank if declines persist.</p>` },
  { cat: "troubleshoot", question: "I can't access the content I purchased.",
    answerHtml: `<p>Sign out and back in, clear your cache, and verify the purchase email. If access is still blocked, reach out to support.</p>` },
  { cat: "troubleshoot", question: "The checkout page won't load properly.",
    answerHtml: `<p>Refresh the page, disable extensions, or try an incognito window. Network filters and VPNs can also interfere with checkout.</p>` },

  // TERMS & POLICIES
  { cat: "policy", question: "Where can I read the terms and policies?",
    answerHtml: `<p>Creators often link terms, privacy, and usage policies on their page or in the footer. Review them before buying.</p>` },
  { cat: "policy", question: "Are there rules on sharing or reselling content?",
    answerHtml: `<p>Most content is licensed for personal use only. Check the usage policy for any restrictions on sharing or redistribution.</p>` },
  { cat: "policy", question: "Do I keep access if I cancel?",
    answerHtml: `<p>Access after cancellation depends on the product type and policy. Some are time-limited; others remain available. Check the product page.</p>` },

  // SUPPORT
  { cat: "support", question: "How do I contact support?",
    answerHtml: `<p>Use the support or contact link on the creator's page. Include your order email and any reference numbers to speed things up.</p>` },
  { cat: "support", question: "How long do support responses take?",
    answerHtml: `<p>Response times vary. Many creators reply within a few business days. For urgent billing issues, provide clear details up front.</p>` },
  { cat: "support", question: "Where can I see service updates or outages?",
    answerHtml: `<p>Check the creator's page or social channels for announcements about maintenance or service updates.</p>` },

  // SECURITY & PRIVACY
  { cat: "security", question: "Is my payment information secure?",
    answerHtml: `<p>Payments are processed by established providers. Always confirm the URL is correct and use secure networks during checkout.</p>` },
  { cat: "security", question: "How is my personal data handled?",
    answerHtml: `<p>See the privacy policy linked on the creator's page. It explains data collection, usage, and retention practices.</p>` },

  // ELIGIBILITY & REGIONAL
  { cat: "eligibility", question: "Are there regional or age restrictions?",
    answerHtml: `<p>Some offers or content may be limited by region or age. Any restrictions should be noted on the product or checkout page.</p>` },
  { cat: "eligibility", question: "Can I purchase from outside my country?",
    answerHtml: `<p>International availability varies. If you see pricing and checkout, it's usually supported; otherwise, contact the creator for options.</p>` },

  // TAX & INVOICES
  { cat: "tax", question: "Will taxes be added at checkout?",
    answerHtml: `<p>Taxes may apply based on your location and product type. Any applicable tax is usually calculated and shown before payment.</p>` },
  { cat: "tax", question: "How do I get a receipt or invoice?",
    answerHtml: `<p>Receipts are typically emailed after purchase and may be downloadable from your account. Check your email and account history.</p>` },

  // TRIALS, CHANGES, GIFTS
  { cat: "trials", question: "Is there a free trial?",
    answerHtml: `<p>Some products include free trials or sample content. If available, it will be clearly shown on the product page.</p>` },
  { cat: "changes", question: "Can features change after I subscribe?",
    answerHtml: `<p>Creators may update features or content over time. Important changes are generally announced on the product page or via email.</p>` },
  { cat: "gifting", question: "Can I gift a purchase to someone else?",
    answerHtml: `<p>Gifting depends on the creator's settings. If supported, you'll usually see a gift option at checkout or in the FAQ.</p>` },

  // BUNDLES & ADD-ONS
  { cat: "bundles", question: "What are bundles or add-ons?",
    answerHtml: `<p>Bundles combine multiple items at a set price. Add-ons provide optional extras. If offered, details appear on the product page.</p>` },
  { cat: "bundles", question: "Can I upgrade later to a bigger bundle?",
    answerHtml: `<p>Upgrade options vary. If supported, you'll typically find them in your account or by contacting support.</p>` },

  // TIMING & EXPIRY
  { cat: "timing", question: "Do discounts expire?",
    answerHtml: `<p>Most offers are time-limited and can end without notice. Always check the current price and expiration details before paying.</p>` },
  { cat: "timing", question: "What happens if an offer ends during checkout?",
    answerHtml: `<p>If an offer changes mid-checkout, refresh and recheck the total. The final price shown at payment confirmation is what you'll be charged.</p>` },
];

// Deterministic selection with category variety
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i=0; i<s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function buildGeneralFaq(nameOrSlug, count = 5, seedStr = "") {
  // guarantee 4–6 items
  const N = Math.min(6, Math.max(4, Number(count)||5));
  const seed = hashStr((seedStr || String(nameOrSlug || "")) + "::faq");
  // bucket by category
  const byCat = FAQ_BANK.reduce((m, x) => (m[x.cat] = (m[x.cat]||[]).concat(x), m), {});
  const cats = Object.keys(byCat).sort();
  // round-robin across categories for variety
  const picks = [];
  let ci = seed % cats.length;
  while (picks.length < N) {
    const cat = cats[ci % cats.length];
    const arr = byCat[cat];
    const idx = (seed + picks.length * 131 + ci * 17) % arr.length;
    // avoid dup questions
    const candidate = arr[idx];
    if (!picks.some(p => p.question === candidate.question)) picks.push(candidate);
    ci++;
  }
  return picks;
}
