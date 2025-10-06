#!/usr/bin/env node
/**
 * H1 – SEO pages safety check
 * Fails if SEO-critical files contain dynamic anti-patterns.
 *
 * Forbidden (render-time) patterns:
 *  - fetch('/api/...' or with baseUrl)/dynamic endpoints in SEO pages
 *  - headers(), cookies(), draftMode()
 *  - export const dynamic = 'force-dynamic'
 *  - Date.now() (non-deterministic)
 *
 * Required:
 *  - export const revalidate = <number>  (for SSG/ISR)
 *
 * You can tailor the FILES list below as your SEO surface grows.
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

// --- Define SEO-critical files (add more as needed) ---
const FILES = [
  'src/app/(public)/page.tsx',                 // Home
  'src/app/(public)/whop/[slug]/page.tsx',     // Whop detail
  'src/app/sitemap.xml/route.ts',              // Sitemap index
  'src/app/sitemap/hubs.xml/route.ts',         // Hubs sitemap
  'src/app/sitemap/whops-a-f.xml/route.ts',
  'src/app/sitemap/whops-g-m.xml/route.ts',
  'src/app/sitemap/whops-n-s.xml/route.ts',
  'src/app/sitemap/whops-t-z.xml/route.ts',
  // Add RSS, blog listing/detail if SEO-critical:
  // 'src/app/blog/page.tsx',
  // 'src/app/blog/[slug]/page.tsx',
];

// --- Rules (regexes) ---
const FORBIDDEN = [
  { name: "fetch('/api' in SEO pages)", regex: /fetch\(\s*['"`](?:https?:\/\/[^'"`]+)?\/api\//g },
  { name: 'headers() usage', regex: /\bheaders\s*\(\s*\)/g },
  { name: 'cookies() usage', regex: /\bcookies\s*\(\s*\)/g },
  { name: 'draftMode() usage', regex: /\bdraftMode\s*\(\s*\)/g },
  { name: "dynamic = 'force-dynamic'", regex: /export\s+const\s+dynamic\s*=\s*['"`]force-dynamic['"`]/g },
  { name: 'Date.now()', regex: /\bDate\.now\s*\(\s*\)/g },
];

const REQUIRED = [
  { name: 'revalidate export', regex: /export\s+const\s+revalidate\s*=\s*\d+/ },
];

let failed = false;
const problems = [];

function readFileMaybe(file) {
  const p = path.join(repoRoot, file);
  if (!fs.existsSync(p)) return null;
  return { path: p, content: fs.readFileSync(p, 'utf8') };
}

for (const file of FILES) {
  const f = readFileMaybe(file);
  if (!f) continue;

  // Forbidden checks
  for (const rule of FORBIDDEN) {
    const matches = f.content.match(rule.regex);
    if (matches) {
      failed = true;
      problems.push({
        file,
        type: 'FORBIDDEN',
        rule: rule.name,
        sample: String(matches[0]).slice(0, 160),
      });
    }
  }

  // Required checks
  for (const rule of REQUIRED) {
    if (!rule.regex.test(f.content)) {
      failed = true;
      problems.push({
        file,
        type: 'REQUIRED',
        rule: rule.name,
        sample: 'Missing required export',
      });
    }
  }
}

if (failed) {
  console.error('❌ SEO safety check failed.\n');
  for (const p of problems) {
    console.error(
      `- [${p.type}] ${p.rule}\n  File: ${p.file}\n  Example: ${p.sample}\n`
    );
  }
  process.exit(1);
}

console.log('✅ SEO safety check passed.');
