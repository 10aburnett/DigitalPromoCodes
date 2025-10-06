#!/usr/bin/env node
/**
 * H2 – Build-time assertion for SEO routes (Next.js App Router)
 * Fails if SEO-critical routes are not ISR/SSG in the compiled output.
 *
 * We read:
 *   - .next/prerender-manifest.json
 *
 * Assertions:
 *   1) "/" exists in routes with numeric initialRevalidateSeconds
 *   2) A dynamic route for "/whop/[slug]" exists in dynamicRoutes with numeric initialRevalidateSeconds
 *
 * Notes:
 * - Numeric initialRevalidateSeconds => SSG/ISR (good)
 * - null / missing => not pre-rendered / dynamic (bad)
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, '.next', 'prerender-manifest.json');

function fail(msg, extra = null) {
  console.error('❌ SEO build assertion failed:\n' + msg);
  if (extra) {
    console.error('\nContext:', JSON.stringify(extra, null, 2));
  }
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail(`Could not find ${manifestPath}. Did 'next build' run?`);
}

const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (e) {
  fail('Invalid prerender-manifest.json (not valid JSON).');
}

const { routes = {}, dynamicRoutes = {} } = manifest;

// --- Assert 1: Home page has ISR ---
const home = routes['/'];
if (!home) {
  fail("Home route '/' is not prerendered (missing in prerender-manifest routes).", { routes });
}
if (
  typeof home.initialRevalidateSeconds !== 'number' ||
  !Number.isFinite(home.initialRevalidateSeconds)
) {
  fail(
    "Home route '/' is not ISR (initialRevalidateSeconds must be a finite number).",
    { home }
  );
}

// --- Assert 2: Whop detail pages are ISR ---
/**
 * With generateStaticParams, individual whop pages are in routes
 * with srcRoute pointing to /whop/[slug]
 */
const whopRoutes = Object.entries(routes).filter(
  ([path, meta]) => meta.srcRoute === '/whop/[slug]'
);

if (whopRoutes.length === 0) {
  fail("Could not find any prerendered whop detail pages (srcRoute: '/whop/[slug]').", {
    routesSample: Object.keys(routes).filter(k => k.startsWith('/whop/')).slice(0, 5),
  });
}

// Check that at least one whop page has ISR configured
const sampleWhop = whopRoutes[0];
const [samplePath, sampleMeta] = sampleWhop;

if (
  typeof sampleMeta.initialRevalidateSeconds !== 'number' ||
  !Number.isFinite(sampleMeta.initialRevalidateSeconds)
) {
  fail(
    `Whop detail pages are not ISR (initialRevalidateSeconds must be a finite number). Checked: ${samplePath}`,
    { [samplePath]: sampleMeta }
  );
}

console.log(`✅ SEO build assertion passed: home + ${whopRoutes.length} whop detail pages are ISR.`);
