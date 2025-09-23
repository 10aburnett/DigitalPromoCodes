// src/lib/gone.ts
import fs from 'node:fs/promises';
import path from 'node:path';

let GONE_SLUGS_CACHE: Set<string> | null = null;

function extractSlugsFromXml(xml: string): Set<string> {
  const slugs = new Set<string>();
  // naive XML parse: pull all <loc>...</loc>
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    try {
      const u = new URL(m[1].trim());
      // Expect paths like /whop/some-slug or /whops/some-slug
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'whop' || parts[0] === 'whops')) {
        const slug = decodeURIComponent(parts[1]).toLowerCase();
        if (slug) slugs.add(slug);
      }
    } catch { /* ignore bad URLs */ }
  }
  return slugs;
}

export async function getGoneWhopSlugs(): Promise<Set<string>> {
  if (GONE_SLUGS_CACHE) return GONE_SLUGS_CACHE;

  // Try reading from public/sitemaps/gone.xml
  const filePath = path.join(process.cwd(), 'public', 'sitemaps', 'gone.xml');
  try {
    const xml = await fs.readFile(filePath, 'utf8');
    GONE_SLUGS_CACHE = extractSlugsFromXml(xml);
    return GONE_SLUGS_CACHE;
  } catch {
    // If file not found, default to empty set (fail-open, but we'll re-check next call)
    GONE_SLUGS_CACHE = new Set();
    return GONE_SLUGS_CACHE;
  }
}

export async function isGoneSlug(slug: string): Promise<boolean> {
  const set = await getGoneWhopSlugs();
  return set.has((slug || '').toLowerCase());
}