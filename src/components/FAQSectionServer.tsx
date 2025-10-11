// src/components/FAQSectionServer.tsx
// Server component for FAQ section using native HTML details/summary

import { FaqItem, parseFaqContent } from '@/lib/faq-types';
import { RenderPlainServer } from '@/lib/RenderPlainServer';
import { looksLikeHtml, toPlainText } from '@/lib/textRender';

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
          {displayFaqs.map((faq, index) => (
            <details
              key={index}
              className="rounded-lg border transition-all duration-200 overflow-hidden group"
              style={{
                backgroundColor: 'var(--background-color)',
                borderColor: 'var(--border-color)'
              }}
            >
              {/* Question Header - Native HTML summary */}
              <summary
                className="w-full p-4 text-left flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity list-none"
              >
                <h3 className="font-semibold text-lg pr-4">{faq.question}</h3>
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>

              {/* Answer Content - Revealed by native details/summary */}
              <div className="px-4 pb-4" style={{ color: 'var(--text-secondary)' }}>
                {faq.isHtml ? (
                  <div
                    className="leading-relaxed prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                    dangerouslySetInnerHTML={{ __html: faq.answer }}
                  />
                ) : (
                  <div className="leading-relaxed">
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
