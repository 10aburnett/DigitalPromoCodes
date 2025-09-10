import DOMPurify from 'isomorphic-dompurify';

export function renderHtmlSafe(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'ul', 'ol', 'li', 'em', 'strong', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'rel'],
    ADD_ATTR: ['rel']
  });
}

export function addNoFollowToLinks(html: string): string {
  return html.replace(/<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
    if (!before.includes('rel=') && !after.includes('rel=')) {
      return `<a ${before}href="${href}" rel="nofollow noopener noreferrer"${after}>`;
    }
    return match;
  });
}

export function sanitizeAndRenderHtml(html: string): string {
  const withNoFollow = addNoFollowToLinks(html);
  return renderHtmlSafe(withNoFollow);
}