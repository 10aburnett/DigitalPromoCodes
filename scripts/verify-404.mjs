#!/usr/bin/env node
/**
 * Verify which HTTP_404 rejects are truly dead vs recoverable
 *
 * Input: data/recovery/rejects-HTTP_404.csv (or any CSV of slugs)
 * Output: logs/verify-404.csv (slug,status)
 *
 * Usage:
 *   node scripts/verify-404.mjs [input.csv]
 *
 * Output statuses:
 *   RECOVERABLE - Page responds with 2xx/3xx
 *   HARD_404 - Page confirmed dead after multiple attempts
 *   NO_URL - No URL found for slug in whops.jsonl
 */

import fs from "fs";
import path from "path";

// Ensure fetch is available (Node <18 compatibility)
if (typeof fetch !== "function") {
  const { fetch: undiciFetch } = await import("undici");
  global.fetch = undiciFetch;
}

const inputFile = process.argv[2] || "data/recovery/rejects-HTTP_404.csv";
const outputFile = "logs/verify-404.csv";
const TIMEOUT = 8000; // 8 seconds per request
const DELAY_MS = 100; // delay between requests to avoid rate limiting

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

// Load slug→url mapping from whops.jsonl
console.log(`📖 Loading whops.jsonl...`);
const whopsFile = "data/neon/whops.jsonl";
const urlMap = {};
if (fs.existsSync(whopsFile)) {
  const lines = fs.readFileSync(whopsFile, "utf8").trim().split("\n");
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.slug && obj.url) {
        urlMap[obj.slug] = obj.url;
      }
    } catch {}
  }
}
console.log(`✅ Loaded ${Object.keys(urlMap).length} URL mappings`);

// Load slugs to verify
console.log(`📖 Reading slugs from: ${inputFile}`);
const slugs = fs.readFileSync(inputFile, "utf8")
  .trim()
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean);
console.log(`✅ Found ${slugs.length} slugs to verify\n`);

// Helper: probe URL with timeout
async function probe(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "WhopCodesBot/1.0 (Content Verification)" },
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    return response.status >= 200 && response.status < 400;
  } catch (err) {
    clearTimeout(timeoutId);
    return false;
  }
}

// Helper: try alternative URLs
function getAlternatives(url) {
  const alts = [url];

  // Try with/without trailing slash
  if (url.endsWith("/")) {
    alts.push(url.slice(0, -1));
  } else {
    alts.push(url + "/");
  }

  // Try http↔https
  if (url.startsWith("https://")) {
    alts.push("http://" + url.slice(8));
  } else if (url.startsWith("http://")) {
    alts.push("https://" + url.slice(7));
  }

  return [...new Set(alts)]; // dedupe
}

// Verify each slug
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, "slug,status,url\n"); // CSV header

let recoverable = 0;
let hard404 = 0;
let noUrl = 0;

console.log("🔍 Verifying URLs...\n");
console.log("─".repeat(70));

for (const [i, slug] of slugs.entries()) {
  const url = urlMap[slug];

  if (!url) {
    fs.appendFileSync(outputFile, `${slug},NO_URL,\n`);
    console.log(`[${String(i + 1).padStart(4)}/${slugs.length}] ${slug.padEnd(40)} NO_URL`);
    noUrl++;
    continue;
  }

  // Try original URL + alternatives
  const alternatives = getAlternatives(url);
  let recovered = false;

  for (const altUrl of alternatives) {
    const ok = await probe(altUrl);
    if (ok) {
      recovered = true;
      fs.appendFileSync(outputFile, `${slug},RECOVERABLE,"${altUrl}"\n`);
      console.log(`[${String(i + 1).padStart(4)}/${slugs.length}] ${slug.padEnd(40)} ✅ RECOVERABLE`);
      recoverable++;
      break;
    }
  }

  if (!recovered) {
    fs.appendFileSync(outputFile, `${slug},HARD_404,"${url}"\n`);
    console.log(`[${String(i + 1).padStart(4)}/${slugs.length}] ${slug.padEnd(40)} ❌ HARD_404`);
    hard404++;
  }

  // Rate limiting delay
  if (i < slugs.length - 1) {
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
}

console.log("─".repeat(70));
console.log(`\n📊 Verification Summary:`);
console.log(`  ✅ RECOVERABLE: ${recoverable} slugs`);
console.log(`  ❌ HARD_404:    ${hard404} slugs`);
console.log(`  ⚠️  NO_URL:     ${noUrl} slugs`);
console.log(`  ═══════════════════════`);
console.log(`  📝 TOTAL:       ${slugs.length} slugs`);
console.log(`\n✅ Results written to: ${outputFile}`);
console.log(`\nNext steps:`);
console.log(`  # Extract recoverable slugs`);
console.log(`  awk -F, '$2=="RECOVERABLE"{print $1}' ${outputFile} > /tmp/urls-recoverable.csv`);
console.log(`\n  # Extract hard 404s`);
console.log(`  awk -F, '$2=="HARD_404"{print $1}' ${outputFile} > /tmp/urls-hard.csv`);
