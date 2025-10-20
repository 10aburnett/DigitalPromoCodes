// src/components/FAQSectionServer.tsx
// Server component for FAQ section using native HTML details/summary

import { FaqItem, parseFaqContent } from '@/lib/faq-types';
import { RenderPlainServer } from '@/lib/RenderPlainServer';
import { looksLikeHtml, toPlainText } from '@/lib/textRender';

// Normalize text/HTML so SSR and client use identical bytes
function normalizeText(s: string) {
  return String(s)
    .replace(/\r\n?/g, '\n')          // CRLF -> LF
    .replace(/\u00a0/g, ' ')          // NBSP -> space
    .replace(/[\u201C\u201D]/g, '"')  // " " -> "
    .replace(/[\u2018\u2019]/g, "'")  // ' ' -> '
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();
}

// Helper to strip HTML tags and normalize whitespace for stable SSR/CSR hydration
function stripTags(input: string): string {
  return input.replace(/<\/?[^>]+(>|$)/g, '');
}

interface LegacyFAQItem {
  question: string;
  answer: string;
}

interface FAQSectionServerProps {
  faqs?: LegacyFAQItem[];
  faqContent?: string | null;
  whopName?: string;
}

// Helper function to determine FAQ content type
function getFaqAnswerType(answerText: string): { text: string; isHtml: boolean } {
  return {
    text: answerText,
    isHtml: looksLikeHtml(answerText)
  };
}

export default function FAQSectionServer({ faqs = [], faqContent, whopName }: FAQSectionServerProps) {
  let displayFaqs: Array<{question: string, answer: string, isHtml: boolean}> = [];
  let jsonLd: any = null;

  // Priority 1: Use structured FAQ content if available
  if (faqContent && faqContent.trim() !== '') {
    const parsed = parseFaqContent(faqContent);

    if (Array.isArray(parsed)) {
      // Structured FAQs from our editor - now support plain text
      displayFaqs = parsed.map(faq => {
        const answerType = getFaqAnswerType(faq.answerHtml);
        return {
          question: faq.question,
          answer: answerType.text,
          isHtml: answerType.isHtml
        };
      });

      // Generate JSON-LD for structured FAQs (use plain text for schema)
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": parsed.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            // For JSON-LD, always use plain text
            "text": toPlainText(faq.answerHtml)
          }
        }))
      };
    } else if (typeof parsed === 'string') {
      // Legacy text content
      displayFaqs = [{
        question: "FAQ Information",
        answer: parsed,
        isHtml: false
      }];
    }
  }

  // Priority 2: Fall back to legacy hardcoded FAQs
  if (displayFaqs.length === 0 && faqs && faqs.length > 0) {
    displayFaqs = faqs.map(faq => ({
      question: faq.question,
      answer: faq.answer,
      isHtml: false
    }));
  }

  if (displayFaqs.length === 0) {
    return null; // Don't render if no FAQs
  }

  // Normalize FAQ data to ensure stable SSR/CSR hydration
  const safeFaqs = displayFaqs.map(f => {
    const q = normalizeText(stripTags(String(f.question)));
    return {
      question: q,
      // Normalize both HTML and plain text answers so bytes match on client
      answer: f.isHtml ? normalizeText(String(f.answer)) : normalizeText(String(f.answer)),
      isHtml: !!f.isHtml,
    };
  });

  return (
    <>
      {/* JSON-LD for structured FAQs */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {safeFaqs.map((faq) => (
            <details
              key={String(faq.question)}
              className="rounded-lg border transition-all duration-200 overflow-hidden"
              style={{
                backgroundColor: 'var(--background-color)',
                borderColor: 'var(--border-color)'
              }}
            >
              {/* Question Header - Native HTML summary with ONLY text content for stable hydration */}
              <summary className="w-full p-4 pr-10 text-left cursor-pointer hover:opacity-80 transition-opacity list-none font-semibold text-lg [&::-webkit-details-marker]:hidden">
                {faq.question}
              </summary>

              {/* Answer Content - Revealed by native details/summary */}
              <div className="px-4 pb-4" style={{ color: 'var(--text-secondary)' }}>
                {faq.isHtml ? (
                  <div
                    className="leading-relaxed prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: faq.answer }}
                  />
                ) : (
                  <div className="leading-relaxed" suppressHydrationWarning>
                    <RenderPlainServer text={faq.answer} />
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
