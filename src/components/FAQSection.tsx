'use client';

import { useState, useEffect } from 'react';
import { FaqItem, parseFaqContent } from '@/lib/faq-types';
import RenderPlain from '@/components/RenderPlain';
import { looksLikeHtml, toPlainText } from '@/lib/textRender';

interface LegacyFAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
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

export default function FAQSection({ faqs = [], faqContent, whopName }: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [displayFaqs, setDisplayFaqs] = useState<Array<{question: string, answer: string, isHtml: boolean}>>([]);
  const [jsonLd, setJsonLd] = useState<any>(null);

  useEffect(() => {
    console.log('🔍 FAQ Debug - faqContent:', faqContent);
    console.log('🔍 FAQ Debug - faqContent type:', typeof faqContent);
    
    // Priority 1: Use structured FAQ content if available
    if (faqContent && faqContent.trim() !== '') {
      const parsed = parseFaqContent(faqContent);
      console.log('🔍 FAQ Debug - parsed result:', parsed);
      console.log('🔍 FAQ Debug - is parsed array:', Array.isArray(parsed));
      
      if (Array.isArray(parsed)) {
        // Structured FAQs from our editor - now support plain text
        const structuredFaqs = parsed.map(faq => {
          const answerType = getFaqAnswerType(faq.answerHtml);
          return {
            question: faq.question,
            answer: answerType.text,
            isHtml: answerType.isHtml
          };
        });
        console.log('✅ FAQ Debug - Using structured FAQs:', structuredFaqs);
        setDisplayFaqs(structuredFaqs);
        
        // Generate JSON-LD for structured FAQs (use plain text for schema)
        generateJsonLd(parsed, whopName);
        return;
      } else if (typeof parsed === 'string') {
        // Legacy text content
        console.log('📝 FAQ Debug - Using legacy text content:', parsed);
        setDisplayFaqs([{
          question: "FAQ Information",
          answer: parsed,
          isHtml: false
        }]);
        setJsonLd(null);
        return;
      }
    }
    
    // Priority 2: Fall back to legacy hardcoded FAQs
    console.log('⚠️ FAQ Debug - Falling back to hardcoded FAQs');
    if (faqs && faqs.length > 0) {
      const legacyFaqs = faqs.map(faq => ({
        question: faq.question,
        answer: faq.answer,
        isHtml: false
      }));
      setDisplayFaqs(legacyFaqs);
      setJsonLd(null);
    }
  }, [faqContent, faqs, whopName]);

  const generateJsonLd = (faqItems: FaqItem[], whopName?: string) => {
    const jsonLdData = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          // For JSON-LD, always use plain text
          "text": toPlainText(faq.answerHtml)
        }
      }))
    };
    setJsonLd(jsonLdData);
  };

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

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
            <div 
              key={index}
              className="rounded-lg border transition-all duration-200 overflow-hidden" 
              style={{ 
                backgroundColor: 'var(--background-color)',
                borderColor: 'var(--border-color)'
              }}
            >
              {/* Question Header - Clickable */}
              <button
                onClick={() => toggleItem(index)}
                className="w-full p-4 text-left flex justify-between items-center hover:opacity-80 transition-opacity"
                aria-expanded={openItems.has(index)}
              >
                <h3 className="font-semibold text-lg pr-4">{faq.question}</h3>
                <div className="flex-shrink-0">
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${
                      openItems.has(index) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Answer Content - Collapsible */}
              <div
                className={`transition-all duration-200 ease-in-out ${
                  openItems.has(index) 
                    ? 'max-h-96 opacity-100' 
                    : 'max-h-0 opacity-0'
                } overflow-hidden`}
              >
                <div className="px-4 pb-4" style={{ color: 'var(--text-secondary)' }}>
                  {faq.isHtml ? (
                    <div 
                      className="leading-relaxed prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                      dangerouslySetInnerHTML={{ __html: faq.answer }}
                    />
                  ) : (
                    <div className="leading-relaxed">
                      <RenderPlain text={faq.answer} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
} 