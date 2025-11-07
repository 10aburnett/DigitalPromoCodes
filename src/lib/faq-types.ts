import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

export interface FaqItem {
  question: string;
  answerHtml: string;
}

export const PlainText = z.string().max(5000); // Use for page sections

export const FaqItemSchema = z.object({
  question: z.string().min(8).max(160),
  // Name stays "answerHtml" but content is plain text
  answerHtml: z.string().min(1).max(3000)
});

export const FaqArraySchema = z.array(FaqItemSchema).min(3).max(12);

export function sanitizeAnswerHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'ul', 'ol', 'li', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href', 'rel', 'target'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
  }).replace(/<a(?![^>]*rel=)/g, '<a rel="nofollow noopener noreferrer"');
}

// Banned generic questions that should not be used
export const BANNED_GENERIC_QUESTIONS = [
  "how to redeem",
  "what is this product",
  "how much does it cost",
  "what is the price",
  "is this free",
  "how do i get this",
  "what do i get"
];

export function isGenericQuestion(question: string): boolean {
  const lowerQuestion = question.toLowerCase();
  return BANNED_GENERIC_QUESTIONS.some(banned => 
    lowerQuestion.includes(banned)
  );
}

export function hasDuplicateQuestions(faqs: FaqItem[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  
  faqs.forEach(faq => {
    const normalized = faq.question.toLowerCase().trim();
    if (seen.has(normalized)) {
      duplicates.push(faq.question);
    } else {
      seen.add(normalized);
    }
  });
  
  return duplicates;
}

// Safe parsing function for backward compatibility
export function parseFaqContent(faqContent: string | null): FaqItem[] | string | null {
  if (!faqContent) return null;
  
  try {
    const parsed = JSON.parse(faqContent);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Validate the structure
      const result = FaqArraySchema.safeParse(parsed);
      if (result.success) {
        return result.data as FaqItem[];
      }
    }
  } catch {
    // Not JSON, return as legacy text
  }
  
  // Return as legacy text for backward compatibility
  return faqContent;
}