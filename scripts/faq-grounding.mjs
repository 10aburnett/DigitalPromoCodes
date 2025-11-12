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
  const sys = `Answer FAQs using ONLY this evidence. Each answer MUST include one verbatim quoted sentence and end with "(Verified on ${host})". If missing, write exactly: "We couldn't verify this from the available sources."`;
  const user = `EVIDENCE:\n${ev}\n\nReturn 4–5 items as JSON array like:\n[{ "question":"...", "answerHtml":"<p>\"quoted sentence from evidence.\" (Verified on ${host})</p>" }]`;
  return await callJSON(sys, user);
}

export function buildQuoteOnlyFaq(evidenceText, host) {
  const sents = (evidenceText.match(/[^.?!]{40,}[.?!]/g) || []).slice(0,4);
  return sents.length
    ? sents.map(s => ({ question: "What we can verify", answerHtml: `<p>"${s.trim()}" (Verified on ${host})</p>` }))
    : [{ question: "Are details verified?", answerHtml: `<p>We couldn't verify this from the available sources.</p>` }];
}
