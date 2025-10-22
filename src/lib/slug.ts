// Always work with decoded, lowercased slugs internally.
export function normalizeSlug(input: string): string {
  // Next usually gives decoded params on the server, but be explicit.
  try {
    input = decodeURIComponent(input);
  } catch { /* noop */ }
  return input.trim().toLowerCase();
}
