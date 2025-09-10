import { sanitizeAndRenderHtml } from './html-sanitizer';

export function isMeaningfulHtml(html?: string | null): boolean {
  if (!html) return false;
  // Strip tags & whitespace to see if anything remains
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  return text.length > 0;
}

export function fromDescriptionToHtml(desc?: string | null): string | null {
  if (!desc) return null;
  
  // Turn plain text into basic paragraphs; keep it simple
  const paragraphs = desc
    .trim()
    .split(/\n{2,}/)             // Split on blank lines if any
    .map(p => `<p>${escapeHtml(p.trim())}</p>`)
    .join('');
    
  return sanitizeAndRenderHtml(paragraphs);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}