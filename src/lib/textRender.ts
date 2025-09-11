export function looksLikeHtml(s?: string | null): boolean {
  if (!s) return false;
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function toPlainText(s: string): string {
  return looksLikeHtml(s) ? s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : s;
}

export function isMeaningful(s?: string | null): boolean {
  if (!s) return false;
  const text = s.replace(/<[^>]*>/g, "").trim();
  return text.length > 0;
}