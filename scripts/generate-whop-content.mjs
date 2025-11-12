#!/usr/bin/env node
/**
 * Batch-generate Whop content from a Neon export using an LLM provider.
 * - Input: data/neon/whops.jsonl OR data/neon/whops.csv
 * - Output (append): data/content/raw/ai-run-YYYYMMDD-HHMM.jsonl
 * - Checkpoint: data/content/.checkpoint.json (resume-safe)
 *
 * ENV you must set:
 *   PROVIDER=openai|anthropic
 *   MODEL=<your model id>
 *   OPENAI_API_KEY=...   (if PROVIDER=openai)
 *   ANTHROPIC_API_KEY=... (if PROVIDER=anthropic)
 *
 * CLI options (optional):
 *   --in path/to/file.{jsonl|csv}
 *   --limit 8000         (max rows to process)
 *   --batch 10           (# concurrent requests)
 *   --skipFilled         (skip rows where all content columns already present)
 *   --sampleEvery 100    (save every Nth success to data/content/samples/ for QA)
 *   --budgetUsd 50       (abort if projected spend exceeds this amount)
 *
 * ENV (optional):
 *   STRONG_MODEL=gpt-4o  (escalation model for failed rows)
 *   BUDGET_USD=50        (alternative to --budgetUsd)
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import os from "os";
import crypto from "crypto";
import { acquireLock, releaseLock } from "./lib/lock.mjs";
import { climbEvidenceLadder } from "./evidence-ladder.mjs";
import { faqIsGrounded, regenerateFaqGrounded, buildQuoteOnlyFaq, buildGeneralFaq } from "./faq-grounding.mjs";
import { buildSyntheticFallback } from "./synthetic-fallback.mjs";
import { detectLang, makeQuoteBank, extractFeaturePhrases } from "./evidence-extractive.mjs";
import { buildExtractiveFromEvidence } from "./extractive-builder.mjs";
import { buildParaphrasedFromEvidence } from "./evidence-paraphraser.mjs";

// Acquire PID lock to prevent concurrent runs
acquireLock({ role: "generator" });
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(130); });
process.on("SIGTERM", () => { releaseLock(); process.exit(143); });

// Ensure fetch is available (Node <18 compatibility)
if (typeof fetch !== "function") {
  const { fetch: undiciFetch } = await import("undici");
  global.fetch = undiciFetch;
}

// Atomic append helper (crash-safe writes)
function appendLineAtomic(file, obj) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, JSON.stringify(obj) + "\n");
    fs.fsyncSync(fd);                       // ensure on disk
    fs.closeSync(fd);
    fs.renameSync(tmp, tmp);                // noop to satisfy macOS caching
    fs.appendFileSync(file, fs.readFileSync(tmp));
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// UA profiles for soft-404 detection
const UA = {
  desktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  mobile:  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
};

// Fetch helper with UA switching and soft-404 detection
async function fetchHtml(url, profile="desktop", referer=null, timeoutMs=10000) {
  const headers = {
    "User-Agent": UA[profile] || UA.desktop,
    "Accept": "text/html,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
  };
  if (referer) headers["Referer"] = referer;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers,
      signal: controller.signal
    });
    const html = await res.text();
    return { res, html };
  } finally {
    clearTimeout(t);
  }
}

function looksSoft404(status, html) {
  if (status !== 404) return false;
  if (!html) return false;
  if (html.length < SOFT404_MIN_LEN) return false;
  const head = html.slice(0, 2000);
  const rx = new RegExp(SOFT404_PHRASES.join("|"), "i");
  return !rx.test(head); // long, normal-looking page while server sent 404
}

function looksLikeWAF(html) {
  const h = (html || "").slice(0, 3000);
  return /cloudflare|please enable javascript|attention required|checking your browser/i.test(h);
}

// Rolling similarity memory
const SIM_TRACK_FILE = "data/content/.simhash.json";
let simState = { recent: [] }; // store last N hashes
try { if (fs.existsSync(SIM_TRACK_FILE)) simState = JSON.parse(fs.readFileSync(SIM_TRACK_FILE,"utf8")); } catch {}
const SIM_MAX = 500;           // track last 500
const SIM_THRESHOLD = 0.90;    // similarity threshold

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

// Support --onlySlugsFile for file-based slug filtering (avoids command substitution)
if (args.onlySlugsFile && !args.onlySlugs) {
  try {
    const content = fs.readFileSync(args.onlySlugsFile, "utf8").trim();
    args.onlySlugs = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(",");
    console.log(`📄 Loaded ${args.onlySlugs.split(",").length} slugs from ${args.onlySlugsFile}`);
  } catch (err) {
    console.error(`❌ Failed to read --onlySlugsFile: ${args.onlySlugsFile}`, err.message);
    process.exit(1);
  }
}

const IN = args.in || (fs.existsSync("data/neon/whops.jsonl") ? "data/neon/whops.jsonl" : "data/neon/whops.csv");
const OUT_DIR = "data/content/raw";
const CHECKPOINT = "data/content/.checkpoint.json";
const FINGERPRINTS_FILE = "data/content/.fingerprints.jsonl";

// --- Write-once guard: Load master indices to prevent duplicate writes -----
const MASTER_ALL = "data/content/master/_master-all-slugs.txt";
const masterAllSlugs = fs.existsSync(MASTER_ALL)
  ? new Set(fs.readFileSync(MASTER_ALL, "utf8").trim().split(/\r?\n/).filter(x => x))
  : new Set();
const writtenThisRun = new Set();  // Track slugs written during this run

// Helper to enforce write-once-by-slug for OUT_FILE
function appendOnce(filePath, obj) {
  const slug = obj?.slug?.trim();
  if (!slug) {
    // No slug - write anyway (shouldn't happen in normal flow)
    fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
    return;
  }

  // Skip if already written (this run or in master)
  if (writtenThisRun.has(slug) || masterAllSlugs.has(slug)) {
    console.log(`[Write-once guard] Skipped duplicate: ${slug}`);
    return;
  }

  // Write and track
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
  writtenThisRun.add(slug);
}
// ----------------------------------------------------------------------------

// --- Checkpoint & fingerprints module ---------------------------------------
function loadJSON(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return fallback; }
}
function saveJSON(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function loadCheckpoint() {
  return loadJSON(CHECKPOINT, {
    version:1, runId:null, outPath:null, rejPath:null,
    completed:[], rejected:[], inflight:[], fingerprintsPath: FINGERPRINTS_FILE
  });
}
function saveCheckpoint(ck) { saveJSON(CHECKPOINT, ck); }

function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n", "utf8");
}

// Iterator for fingerprints file
function* iterFingerprints() {
  try {
    const lines = fs.readFileSync(FINGERPRINTS_FILE, "utf8").split("\n");
    for (const l of lines) if (l.trim()) yield JSON.parse(l);
  } catch {}
}
function loadFingerprints() {
  const map = new Map();
  for (const { slug, sha } of iterFingerprints()) map.set(slug, sha);
  return map;
}
function appendFingerprint({ slug, sha }) { appendJsonl(FINGERPRINTS_FILE, { slug, sha }); }

// Deterministic digest of a result row (strip volatile bits)
function stableDigest(obj) {
  const shallow = {
    slug: obj.slug,
    aboutcontent: obj.aboutcontent,
    howtoredeemcontent: obj.howtoredeemcontent,
    promodetailscontent: obj.promodetailscontent,
    termscontent: obj.termscontent,
    faqcontent: obj.faqcontent,
  };
  const s = JSON.stringify(shallow);
  return crypto.createHash("sha1").update(s).digest("hex");
}
// --- End checkpoint module --------------------------------------------------

// --- Budget manager ---------------------------------------------------------
// Defaults (edit if your account pricing differs)
// Units: USD per 1M tokens
const PRICE_IN_PER_MTOK  = Number(process.env.PRICE_IN_PER_MTOK  || "5");   // e.g., 4o input
const PRICE_OUT_PER_MTOK = Number(process.env.PRICE_OUT_PER_MTOK || "15");  // e.g., 4o output

function loadUsage() {
  try { return JSON.parse(fs.readFileSync("data/content/.usage.json", "utf8")); } catch { return { runs: [] }; }
}
function saveUsage(u) {
  fs.mkdirSync(path.dirname("data/content/.usage.json"), { recursive: true });
  fs.writeFileSync("data/content/.usage.json", JSON.stringify(u, null, 2));
}

function estCostUSD(promptTokens, completionTokens) {
  const inUSD  = (promptTokens     / 1_000_000) * PRICE_IN_PER_MTOK;
  const outUSD = (completionTokens / 1_000_000) * PRICE_OUT_PER_MTOK;
  return inUSD + outUSD;
}

function makeBudgetManager(opts) {
  const capUSD      = Number(opts.capUSD || 0) || null; // from --budgetUsd
  const softRatio   = 0.98; // stop slightly early to avoid race conditions
  let spentUSD      = 0;
  let promptSoFar   = 0;
  let completionSoFar = 0;

  return {
    canAfford(nextPromptTok, nextCompletionTok) {
      if (!capUSD) return true;
      const willCost = estCostUSD(nextPromptTok, nextCompletionTok);
      return (spentUSD + willCost) <= capUSD * softRatio;
    },
    record(usage) {
      // usage: { prompt_tokens, completion_tokens } or { input_tokens, output_tokens }
      const p = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
      const c = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
      promptSoFar += p; completionSoFar += c;
      spentUSD += estCostUSD(p, c);
    },
    summary() {
      return { spentUSD: Number(spentUSD.toFixed(4)), promptSoFar, completionSoFar, capUSD };
    },
    persistRunMeta(meta = {}) {
      const u = loadUsage();
      if (!u.runs) u.runs = []; // Ensure runs array exists
      u.runs.push({
        at: new Date().toISOString(),
        provider: process.env.PROVIDER || "openai",
        model: MODEL,
        ...this.summary(),
        ...meta
      });
      saveUsage(u);
    }
  };
}
// --- End budget manager -----------------------------------------------------

// === [PATCH] Overrides + CSV logging =========================================
const OVERRIDES_FILE = "data/overrides/hub-product-map.json";      // { "<creator-slug>": "/creator/product-slug/" }
const REVIEW_CSV     = "data/content/hub-review.csv";              // unresolved hubs
const OVERRIDE_HITS  = "data/content/hub-override-hits.csv";       // when an override is used
const CADENCE_CSV    = "data/content/cadence-review.csv";          // cadence validation failures

// Product acceptance thresholds (prevents thin product pages from replacing hubs)
const PRODUCT_MIN_CHARS = 900;   // hard minimum for product pages
const PRODUCT_SOFT_MIN = 800;    // soft minimum if page clearly has reviews/FAQs

const LIMIT = args.limit ? Number(args.limit) : Infinity;
const CONCURRENCY = args.batch ? Number(args.batch) : 8;
const SKIP_FILLED = !!args.skipFilled;
const DRY_RUN = !!args.dryRun;
const SAMPLE_EVERY = args.sampleEvery ? Number(args.sampleEvery) : 0;
const SAMPLE_DIR = "data/content/samples";
if (SAMPLE_EVERY && !fs.existsSync(SAMPLE_DIR)) fs.mkdirSync(SAMPLE_DIR, { recursive: true });
const CACHE_DIR = "data/content/cache";
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Ensure override dirs exist
fs.mkdirSync("data/overrides", { recursive: true });

// Load override map (safe default)
function loadHubOverrides() {
  try {
    const raw = fs.readFileSync(OVERRIDES_FILE, "utf8");
    const json = JSON.parse(raw || "{}");
    return json && typeof json === "object" ? json : {};
  } catch { return {}; }
}
let HUB_OVERRIDES = loadHubOverrides();

// Simple CSV writer (adds header on first use)
function writeCsvRow(path, headers, row) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (!fs.existsSync(path)) fs.writeFileSync(path, headers.map(esc).join(",") + "\n");
  fs.appendFileSync(path, row.map(esc).join(",") + "\n");
}

// Ensure data/content directory exists for fingerprints persistence (cold start resilience)
const CONTENT_DIR = "data/content";
if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

const MAX_REPAIRS = 2; // attempts to repair with same model
const ESCALATE_ON_FAIL = true;
const STRONG_MODEL = process.env.STRONG_MODEL || ""; // e.g., "gpt-4o" (optional)
const BUDGET_USD = args.budgetUsd ? Number(args.budgetUsd) : (process.env.BUDGET_USD ? Number(process.env.BUDGET_USD) : 0);
const PRACTICE_STRICT = process.env.PRACTICE_STRICT === "1"; // if false, enables soft tolerances for practice/testing
const WORD_COUNT_TOLERANCE = 10; // allow ≥ min-10 in practice/testing to prevent budget burn on edge cases
const STEP_WORD_MIN = 10; // hard minimum words per redemption step
const STEP_WORD_MAX = 20; // maximum words per redemption step
const STEP_WORD_TOLERANCE = 2; // practice-mode soft tolerance for step word counts

// Evidence fetching configuration
const EVIDENCE_TTL_DAYS = Number(process.env.EVIDENCE_TTL_DAYS || 7);
const MAX_HOST_CONCURRENCY = Number(process.env.MAX_HOST_CONCURRENCY || 2);
const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(",").map(h => h.trim()) : [];
const RESPECT_ROBOTS = process.env.RESPECT_ROBOTS === "1";
const FORCE_RECRAWL = !!args.forceRecrawl;

// Generic FAQ fast-path configuration
const GENERIC_FAQ_SLUGS_FILE = process.env.GENERIC_FAQ_SLUGS_FILE || "";
let GENERIC_FAQ_SLUGS = new Set();
if (GENERIC_FAQ_SLUGS_FILE) {
  try {
    const txt = fs.readFileSync(GENERIC_FAQ_SLUGS_FILE, "utf8");
    GENERIC_FAQ_SLUGS = new Set(txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
    console.log(`📁 Loaded ${GENERIC_FAQ_SLUGS.size} slugs for generic FAQs from ${GENERIC_FAQ_SLUGS_FILE}`);
  } catch (e) {
    console.warn(`⚠️  Could not read GENERIC_FAQ_SLUGS_FILE: ${e.message}`);
  }
}
const FORCE_GENERIC_ON_PRIOR_FAQ_REJECT = (process.env.FORCE_GENERIC_ON_PRIOR_FAQ_REJECT === "1");

// Configure your token-to-USD map (rough; adjust as needed)
const PRICE = {
  openai: { in: 0.00015/1000, out: 0.00060/1000 }, // $/token, example for gpt-4o-mini
  anthropic: { in: 0.00080/1000, out: 0.00120/1000 }, // adjust if you ever use it
};

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync("data/neon")) fs.mkdirSync("data/neon", { recursive: true });

// Concurrency guard handled by PID-based lock at top of file (line 35)

const PROVIDER = process.env.PROVIDER || "openai"; // or "anthropic"
const MODEL = process.env.MODEL || "gpt-4o-mini"; // Default to cost-effective model

// Instantiate budget manager (uses existing BUDGET_USD from line 212)
const budget = makeBudgetManager({ capUSD: BUDGET_USD });

let usageTotals = { input: 0, output: 0 };
let drilledCount = 0;  // Track hub drill-down successes

// Evidence helpers
function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Host allowlist checker with basic glob support
function isHostAllowed(url) {
  if (ALLOWED_HOSTS.length === 0) return true; // no restriction
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some(pattern => {
      // Basic glob: *.example.com matches sub.example.com
      const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i");
      return regex.test(hostname);
    });
  } catch {
    return false; // invalid URL
  }
}

// HTTP fetcher with timeout and polite headers
async function fetchHttp(url, { timeoutMs = 10000 } = {}) {
  // Primary probe: desktop UA
  let { res: r1, html: html1 } = await fetchHtml(url, "desktop", null);
  let status1 = r1.status;

  // Soft-404 downgrade
  if (looksSoft404(status1, html1)) {
    console.log(`⚡ Soft-404 detected for ${url} - treating as 200`);
    status1 = 200;
  }

  // If we still look dead/blocked or tiny OR hit a WAF, do a second probe (mobile UA + Google referer)
  let rFinal = r1, htmlFinal = html1, statusFinal = status1, probe = "desktop";
  let status2, html2, r2;
  let forceMobileProbe = looksLikeWAF(html1);

  if (
    ((status1 === 404 || status1 === 403 || html1.length < RELAXED_MIN_EVIDENCE_CHARS) || forceMobileProbe) &&
    PROBE_ON_404
  ) {
    if (forceMobileProbe) {
      console.log(`⚡ WAF/interstitial detected for ${url} - forcing mobile probe`);
    }
    const result = await fetchHtml(url, "mobile", "https://www.google.com/");
    r2 = result.res;
    html2 = result.html;
    status2 = r2.status;

    if (looksSoft404(status2, html2)) {
      console.log(`⚡ Soft-404 detected on mobile probe for ${url} - treating as 200`);
      status2 = 200;
    }

    // Prefer the second probe if it's clearly better
    if (status2 === 200 && html2.length >= RELAXED_MIN_EVIDENCE_CHARS) {
      rFinal = r2;
      htmlFinal = html2;
      statusFinal = 200;
      probe = "mobile+referer";
      console.log(`✅ Mobile probe successful for ${url} (${html2.length} chars)`);
    }
  }

  // Return rich metadata for diagnostics
  return {
    status: statusFinal,
    text: htmlFinal,
    url: rFinal.url || url,
    headers: rFinal.headers,
    _meta: {
      status1,
      status2,
      len1: html1?.length ?? 0,
      len2: html2?.length ?? 0,
      finalUrl1: r1?.url ?? url,
      finalUrl2: r2?.url ?? null,
      probeUsed: probe,
      soft404Probe1: looksSoft404(status1, html1),
      soft404Probe2: status2 ? looksSoft404(status2, html2) : null,
    }
  };
}

// Extract structured evidence from HTML
// Extract meta/OG/JSON-LD signals (for SPA pages with thin visible text)
function extractMetaSignals(html) {
  const out = [];
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim();
  if (title) out.push(title);

  const get = (name) => {
    const rx = new RegExp(`<meta[^>]+(?:name|property)=(['"])${name}\\1[^>]*content=(['"])([^"']+)\\2`, 'i');
    return html.match(rx)?.[3] || null;
  };
  const ogTitle = get("og:title");
  const ogDesc  = get("og:description");
  const desc    = get("description");
  [ogTitle, ogDesc, desc].filter(Boolean).forEach(s => out.push(s));

  // grab JSON-LD snippets (often present on marketplace pages)
  const jsonlds = [...html.matchAll(/<script[^>]+type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonlds) {
    const t = (m[1] || "").replace(/\s+/g, " ").slice(0, 800);
    if (t.length > 80) out.push(t);
  }
  return out;
}

// Build a "human-visible" text snapshot from HTML for paraphrasing.
// Goal: keep what a user actually reads, drop scripts/JSON/attrs/URLs.
function buildVisibleTextFromHtml(html) {
  if (!html) return "";

  let cleaned = html;

  // 1) Drop whole script/style/noscript/head blocks
  cleaned = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ");

  // 2) Prefer main/article/section if present, fall back to body
  const mainMatch =
    cleaned.match(/<(main|article|section)[^>]*>([\s\S]*?)<\/\1>/i) ||
    cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (mainMatch) {
    cleaned = mainMatch[2] || mainMatch[1] || cleaned;
  }

  // 3) Turn block-level tags into newlines to preserve structure
  cleaned = cleaned
    .replace(/<\/(p|div|li|h[1-6]|section|article|br|tr)>/gi, "\n")
    .replace(/<(p|div|li|h[1-6]|section|article|br|tr)[^>]*>/gi, " ");

  // 4) Strip remaining tags
  cleaned = cleaned.replace(/<\/?[^>]+>/g, " ");

  // 5) Normalise whitespace
  cleaned = cleaned.replace(/\r/g, "\n").replace(/\t/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // 6) Split into pseudo-lines by punctuation + length clamping
  const chunks = cleaned
    .split(/(?<=[.!?])\s+/) // sentence-ish split
    .map(s => s.trim())
    .filter(s => s.length >= 30 && s.length <= 400)
    .filter(s => {
      // Drop obviously non-human lines: URLs, encodings, CSS junk
      if (/https?:\/\//i.test(s)) return false;
      if (/%2F|%3D|%3F|%26|&#x[0-9a-f]+;/i.test(s)) return false;
      if (/[{}\[\]]/.test(s)) return false;
      if (/data-radix|class=|href=|src=|rel=|width:|height:/i.test(s)) return false;
      // Require at least a couple of letters
      if (!/[A-Za-zÀ-ÿ].*[A-Za-zÀ-ÿ]/.test(s)) return false;
      return true;
    });

  // 7) Join back and hard-cap length
  const result = chunks.join(" ").slice(0, 10000);
  return result;
}

function extractFromHtml(html, baseUrl) {
  const strip = s => s.replace(/<script[\s\S]*?<\/script>/gi, "")
                      .replace(/<style[\s\S]*?<\/style>/gi, "")
                      .replace(/<\/?[^>]+>/g, " ")
                      .replace(/\s+/g, " ").trim();

  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const h1 = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");

  const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => strip(m[1])).filter(Boolean);
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => strip(m[1])).filter(Boolean).slice(0, 120);
  const priceish = [...html.matchAll(/(?:£|\$|€)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g)]
                    .map(m => m[0]).slice(0, 20);

  const faq = [];
  const qaRegex = /<(?:h3|dt)[^>]*>([\s\S]*?)<\/(?:h3|dt)>\s*<(?:p|dd)[^>]*>([\s\S]*?)<\/(?:p|dd)>/gi;
  let m;
  while ((m = qaRegex.exec(html)) && faq.length < 15) {
    const q = strip(m[1]);
    const a = strip(m[2]);
    if (q && a) faq.push({ question: q, answer: a });
  }

  const longText = strip(html).slice(0, 12000);

  // visibleText: clean, user-visible text for paraphraser (capped at 10k chars)
  const visibleText = buildVisibleTextFromHtml(html);

  // Extract meta signals for SPA detection
  const metaSignals = extractMetaSignals(html);
  const metaText = metaSignals.join(". ");
  const metaWords = metaText.split(/\s+/).filter(Boolean).length;

  return {
    baseUrl,
    title,
    h1,
    bullets: liMatches.slice(0, 80),
    paras: pMatches,
    priceTokens: priceish,
    faq,
    textSample: longText,
    visibleText,  // for paraphraser
    metaWords,  // for SPA guardrail bypass
    metaText    // for debug
  };
}

// Per-host concurrency limiter
const hostInFlight = new Map();
async function withHostSlot(u, fn) {
  const { host } = new URL(u);
  while ((hostInFlight.get(host) || 0) >= MAX_HOST_CONCURRENCY) await sleep(100);
  hostInFlight.set(host, (hostInFlight.get(host) || 0) + 1);
  try {
    return await fn();
  } finally {
    hostInFlight.set(host, (hostInFlight.get(host) || 0) - 1);
  }
}

// Obtain evidence with caching and retry logic
async function obtainEvidence(url, slug, name, forceRecrawl = false) {
  // Normalise early so any internal reference is safe
  const dbName = (name ?? slug);

  // Host allowlist check
  if (!isHostAllowed(url)) {
    throw new Error(`Host not in ALLOWED_HOSTS: ${new URL(url).hostname}`);
  }

  // Canonicalize URL for cache equivalence
  try {
    const u = new URL(url);
    u.hash = ""; // remove fragment
    // Drop common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(p => u.searchParams.delete(p));
    url = u.toString();
  } catch {}

  // Cache key guard for duplicate slugs (salt with URL hash)
  const urlParsed = new URL(url);
  const uhash = sha256(urlParsed.origin + urlParsed.pathname);
  const cachePath = path.join(CACHE_DIR, `${slug}-${uhash.slice(0, 8)}.evidence.json`);

  // Reuse cache if present and recent (configurable TTL), unless force recrawl
  const ttlMs = 1000 * 60 * 60 * 24 * EVIDENCE_TTL_DAYS;
  if (!forceRecrawl && fs.existsSync(cachePath)) {
    try {
      const j = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (j && j.textHash && j.fetchedAt && (Date.now() - Date.parse(j.fetchedAt) < ttlMs)) {
        return j;
      }
    } catch {}
  }

  const doFetch = async () => {
    const resp = await fetchHttp(url);
    const { status, text, url: fetchedUrl, headers, _meta } = resp;
    let finalUrl = fetchedUrl;  // mutable for drill-down reassignment

    // HTML debug capture (after fetch, before extraction)
    if (SAVE_HTML_DEBUG) {
      try {
        const safe = slug.replace(/[^a-z0-9_-]/gi, "_");
        const dir = "data/debug/html";
        fs.mkdirSync(dir, { recursive: true });
        const metaOut = {
          slug, url, finalUrl: fetchedUrl, status,
          len: (text || "").length, meta: _meta || null,
          ts: new Date().toISOString(),
        };
        fs.writeFileSync(`${dir}/${safe}.meta.json`, JSON.stringify(metaOut, null, 2));
        // only store small sample if huge
        const body = text.length > 200_000 ? text.slice(0, 200_000) : text;
        fs.writeFileSync(`${dir}/${safe}.raw.html`, body);
      } catch {}
    }

    // Content-Type sanity check (avoid caching non-HTML)
    const ct = (headers?.get?.("content-type") || "").toLowerCase();
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml")) {
      throw new Error(`Non-HTML content-type: ${ct}`);
    }

    if (status >= 200 && status < 400 && /<html|<!doctype/i.test(text)) {
      const html1 = text;  // keep raw HTML for link scraping
      const ex = extractFromHtml(html1, finalUrl);

      // Cookie-wall / JS-shell detection
      let textLength = (ex.textSample || "").length;  // mutable for drill-down reassignment
      if (textLength < 400) {
        const lowerText = html1.toLowerCase();
        if (lowerText.includes("enable javascript") || lowerText.includes("cookie settings") ||
            lowerText.includes("cookies are required") || lowerText.includes("javascript is disabled")) {
          throw new Error(`Page gated: skeleton DOM (cookie wall or JS required)`);
        }
      }

      // CAPTCHA / bot protection detection
      const lowerBody = html1.toLowerCase();
      if (lowerBody.includes("hcaptcha") || lowerBody.includes("recaptcha") ||
          lowerBody.includes("cloudflare") && lowerBody.includes("checking your browser")) {
        throw Object.assign(new Error(`CAPTCHA/bot protection detected`), { retryable: true });
      }

      // --- Hub drill-down (Option C + semantic) ------------------------------------
      let drilled = false;
      try {
        const u0 = urlParts(finalUrl || url || "");
        if (u0 && u0.parts.length >= 1) {
          // creator path looks like /creator/...
          const creator = "/" + u0.parts[0] + "/";
          const creatorKey = normSlug(u0.parts[0]);
          // dbName already defined at function top

          if (isLikelyThinHub(html1, textLength)) {
            console.log(`hub_probe: slug=${slug} creator=${creator} evidence=${textLength} chars`);

            // 0) Override map check
            let overrideUsed = false;
            const overridePath = HUB_OVERRIDES[creatorKey] || HUB_OVERRIDES[slug];
            const toProbe = [];

            if (overridePath && overridePath.startsWith(creator)) {
              try {
                const productUrlObj = new URL(u0.origin + overridePath);
                if (u0.search) {
                  const origUrl = new URL(u0.href);
                  origUrl.searchParams.forEach((v, k) => productUrlObj.searchParams.set(k, v));
                }
                toProbe.push({ path: overridePath, anchor: "[override]", heading: "" , url: productUrlObj.toString() });
                overrideUsed = true;
                writeCsvRow(OVERRIDE_HITS,
                  ["slug","creator","overridePath","finalUrl"],
                  [slug, creator, overridePath, productUrlObj.toString()]
                );
              } catch {}
            }

            // 1) No override? Build semantic candidates from the hub HTML
            if (!overrideUsed) {
              const candidates = extractProductCandidates(html1, creator);
              const picks = chooseBestProductCandidates(candidates, slug, dbName);
              if (!picks.length) {
                console.log(`hub_no_match: slug=${slug} candidates=${candidates.length}`);
                writeCsvRow(REVIEW_CSV,
                  ["slug","creatorUrl","candidateCount","exampleCandidates","hubChars"],
                  [slug, u0.href, String(candidates.length), candidates.slice(0,5).map(c=>c.path).join(" | "), String(textLength)]
                );
              }
              // construct URLs preserving query params
              for (const p of picks) {
                try {
                  const u = new URL(u0.origin + p.path);
                  if (u0.search) {
                    const origUrl = new URL(u0.href);
                    origUrl.searchParams.forEach((v, k) => u.searchParams.set(k, v));
                  }
                  toProbe.push({ ...p, url: u.toString() });
                } catch {}
              }
            }

            // 2) Probe 1–2 best candidates
            for (const cand of toProbe.slice(0, 2)) {
              console.log(`hub_drill: slug=${slug} → ${cand.url}`);
              const r2 = await fetchHttp(cand.url);
              if (r2.status >= 200 && r2.status < 400 && /<html|<!doctype/i.test(r2.text)) {
                // sanity: brand tokens seen in <title>/<h1|h2>
                if (!brandTokenPresent(r2.text, dbName)) {
                  console.log(`hub_sanity_fail: slug=${slug} candidate=${cand.path}`);
                  continue;
                }
                const ex2 = extractFromHtml(r2.text, r2.url);
                const chars2 = (ex2.textSample || "").length; // char count consistent with textLength
                // Accept only if the product page is truly richer
                const useful2 = hasUsefulBlocks(r2.text);
                const improvesBy = chars2 - textLength;

                if (
                  chars2 >= PRODUCT_MIN_CHARS ||
                  (chars2 >= PRODUCT_SOFT_MIN && useful2) ||
                  improvesBy >= 300 // stronger "+gain" requirement for swaps
                ) {
                  Object.assign(ex, ex2);
                  textLength = chars2;
                  finalUrl = r2.url;
                  drilled = true;
                  console.log(`hub_success: slug=${slug} improved_chars=${chars2}, useful=${useful2}`);
                  break; // stop after a successful drill
                } else {
                  console.log(`hub_no_gain: slug=${slug} chars2=${chars2}, useful=${useful2}, Δ=${improvesBy}`);
                }
              } else {
                console.log(`hub_fetch_fail: slug=${slug} status=${r2.status}`);
              }
            }

            // 3) If we still didn't improve, log to review queue
            if (!drilled) {
              writeCsvRow(REVIEW_CSV,
                ["slug","creatorUrl","candidateCount","exampleCandidates","hubChars"],
                [slug, u0.href, String(toProbe.length), toProbe.slice(0,5).map(p=>p.path).join(" | "), String(textLength)]
              );
            }
          }
        }
      } catch (e) {
        console.log(`hub_error: slug=${slug} err=${(e && e.message) || e}`);
      }
      // --- end semantic drill-down --------------------------------------------------

      // Thin evidence guard with SPA bypass: require minimum signal
      const contentCount = (ex.paras?.length || 0) + (ex.bullets?.length || 0);
      const metaWords = ex.metaWords || 0;
      const effectiveWords = textLength / 5 + Math.floor(metaWords * 0.8); // rough word count

      // Check if this is a known SPA domain (like whop.com)
      const urlHost = new URL(finalUrl).hostname;
      const IS_KNOWN_SPA = /(^|\.)whop\.com$/i.test(urlHost);

      // Allow meta-only passes for known SPAs with healthy meta signals
      const metaOnlyPass = (status === 200 && IS_KNOWN_SPA && metaWords >= 25);

      // Must-succeed mode: climb evidence ladder if initial fetch is insufficient
      if (!metaOnlyPass && (contentCount < 2 || textLength < 250) && ACTIVE_POLICY.retryUntilSuccess) {
        console.log(`📶 Must-succeed mode: evidence insufficient, climbing ladder...`);
        const minChars = ACTIVE_POLICY.evidenceChars || 300;
        const ladderResult = await climbEvidenceLadder(finalUrl, html1, minChars);

        if (ladderResult.ok) {
          // Re-extract from ladder HTML
          const ex2 = extractFromHtml(ladderResult.html, ladderResult.url);
          // Enrich evidence with extractive fields (cheap, deterministic)
          // Use HTML for quotes (preserves sentence boundaries better than stripped text)
          const baseForExtraction = ladderResult.html || ex2.textSample || "";
          const lang = detectLang(baseForExtraction);
          const quotes = makeQuoteBank(baseForExtraction);
          const features = extractFeaturePhrases(baseForExtraction);

          const evidence = {
            ...ex2,
            finalUrl: ladderResult.url,
            fetchedAt: new Date().toISOString(),
            textHash: sha256(ex2.textSample || ""),
            evidenceSource: ladderResult.source,
            drilled: false,
            lang,
            quotes,
            features
          };
          fs.writeFileSync(cachePath, JSON.stringify(evidence, null, 2));
          console.log(`✅ Evidence ladder success: ${ladderResult.source} (${(ex2.textSample || "").length} chars)`);
          return evidence;
        } else {
          console.warn(`⚠️  Evidence ladder exhausted: ${ladderResult.why}`);
          // Fall through to normal insufficient evidence handling
        }
      }

      if (!metaOnlyPass && (contentCount < 2 || textLength < 250)) {
        console.warn(`⚠️  Skipping ${slug}: Insufficient evidence (${contentCount} blocks, ${textLength} chars, ${metaWords} meta words)`);
        return null;
      }

      if (metaOnlyPass && contentCount < 2) {
        console.log(`✅ SPA bypass for ${slug}: meta-only pass (${metaWords} meta words, ${textLength} chars)`);
      }

      // Enrich evidence with extractive fields (cheap, deterministic)
      // Use HTML for quotes (preserves sentence boundaries better than stripped text)
      const baseForExtraction = html1 || ex.textSample || "";
      const lang = detectLang(baseForExtraction);
      const quotes = makeQuoteBank(baseForExtraction);
      const features = extractFeaturePhrases(baseForExtraction);

      const evidence = {
        ...ex,
        finalUrl, // store final URL after redirects
        fetchedAt: new Date().toISOString(),
        textHash: sha256(ex.textSample || ""),
        drilled, // track if hub drill-down was used
        html: html1, // carry raw HTML forward for FAQ grounding
        textSample: ex.textSample || "", // ensure non-null
        lang,
        quotes,
        features
      };
      fs.writeFileSync(cachePath, JSON.stringify(evidence, null, 2));
      return evidence;
    }
    // Mark rate-limit errors as retryable
    if (status === 429 || status === 403) {
      throw Object.assign(new Error(`Rate limited (${status})`), { retryable: true });
    }
    // Return null for 404s and other non-retryable errors (soft skip)
    console.warn(`⚠️  Skipping ${slug}: Unable to fetch evidence (status ${status})`);
    return null;
  };

  return await withHostSlot(url, async () => {
    const maxTries = 3;
    for (let t = 1; t <= maxTries; t++) {
      try {
        return await doFetch();
      } catch (e) {
        if (t === maxTries || !e.retryable) throw e;
        // Exponential backoff with jitter for rate limits
        const backoff = 750 * t * t + Math.floor(Math.random() * 300);
        await sleep(backoff);
      }
    }
  });
}

const api = {
  async _callLLMRaw(prompt) {
    if (PROVIDER === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY missing");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" } // reduces off-format drift
        })
      });
      if (!res.ok) {
        const t = await res.text().catch(()=>res.statusText);
        throw new Error(`OpenAI ${res.status} ${t}`);
      }
      const data = await res.json();
      // Track token usage
      if (data?.usage) {
        usageTotals.input += data.usage.prompt_tokens || 0;
        usageTotals.output += data.usage.completion_tokens || 0;
        budget.record(data.usage);
      }
      return data.choices?.[0]?.message?.content ?? "";
    } else if (PROVIDER === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY missing");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) {
        const t = await res.text().catch(()=>res.statusText);
        throw new Error(`Anthropic ${res.status} ${t}`);
      }
      const data = await res.json();
      // Track token usage
      if (data?.usage) {
        usageTotals.input += data.usage.input_tokens || 0;
        usageTotals.output += data.usage.output_tokens || 0;
        budget.record(data.usage);
      }
      const content = (data.content && data.content[0] && data.content[0].text) || "";
      return content;
    } else {
      throw new Error(`Unknown PROVIDER=${PROVIDER}`);
    }
  },

  // Wrapper with retry/backoff and budget check
  async callLLM(prompt) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Budget check before each attempt using BudgetManager
      const { spentUSD, capUSD } = budget.summary();
      if (capUSD && spentUSD >= capUSD * 0.98) {
        throw new Error(`Budget cap reached: $${spentUSD.toFixed(2)} / $${capUSD.toFixed(2)}`);
      }

      try {
        return await this._callLLMRaw(prompt);
      } catch (e) {
        const status = e.message.match(/\b(429|5\d\d)\b/);
        const isRetryable = status && (status[1] === "429" || parseInt(status[1]) >= 500);

        if (attempt === maxRetries || !isRetryable) throw e;

        // Exponential backoff with jitter for rate limits
        const backoff = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(backoff);
      }
    }
  }
};

// ------- Prompts (SEO-Optimized, Evidence-Based) -------
const SYSTEM_PROMPT = `
You are an expert content writer for SEO-optimized coupon and offer pages.
Your job is to generate accurate, engaging, and search-friendly HTML content blocks for Whop listings.

CRITICAL FOUNDATION:
- Use ONLY the EVIDENCE provided. Never fabricate facts.
- If EVIDENCE lacks a detail, omit it or say "confirm at checkout".
- Platform mentions are conditional: mention "Whop" only if the source URL is on whop.com.
- Only use "verified" if present in EVIDENCE; otherwise avoid that word.
- Keyword hierarchy: primary ("promo code") ≤ 1 per section; secondary ("discount", "offer", etc.) ≤ 2 combined per section.
- Uniqueness: avoid boilerplate; vary CTA phrasing across listings.

SEO REQUIREMENTS (based on top-ranking coupon pages):

**CRITICAL KEYWORD PLACEMENT RULE:**
- Use the exact phrase "\${safeName} promo code" **ONLY ONCE, in the first paragraph of aboutcontent**.
- **DO NOT** use the exact phrase "promo code" in any other section (howtoredeemcontent, promodetailscontent, termscontent, or faqcontent).
- In all other sections, use secondary keywords: "discount", "offer", "current deal", "saving", etc.

1. aboutcontent (130-170 words, HARD MIN 120, **MUST BE 2-3 paragraphs**):
   - **FORMAT**: Output as 2–3 <p> paragraphs (no other formatting)
   - **CRITICAL**: Write exactly 2–3 complete paragraphs. Do NOT write just 1 paragraph.
   - MUST include "\${safeName} promo code" naturally in the first paragraph (critical for SEO - Whop uses "promo code" terminology). Use this exact phrase ONLY ONCE.
   - Optionally sprinkle "discount", "offer", or "save on \${safeName}" as secondary keywords (≤2 total).
   - Explain what the course or product is and why it's useful.
   - Conditional platform mention: if on whop.com, you may mention "Whop" once.
   - End with a varied call-to-action (explore/compare/check/start/look pattern - vary phrasing per listing to avoid Google fingerprinting).
   - Use Grade 8-10 English, varied sentence lengths (≥3 sentences with mean 13–22 words, stdev ≥4 for human cadence).
   - **HARD MINIMUM**: If your draft is under 120 words OR only 1 paragraph, continue writing until you have 2–3 paragraphs and at least 120 words. Do not stop early.

2. promodetailscontent (100-150 words):
   - Include a <ul> list of 3-5 bullet points summarizing key benefits or pricing tiers.
   - Use "current offer" or "available discount" (avoid "verified" unless evidenced).
   - **DO NOT use "promo code" here** - use "discount", "offer", "deal" instead.
   - Focus on value propositions and what makes this offer unique.
   - CRITICAL: Start each bullet with an action verb (imperative voice: Use/Apply/Access/Choose/Get/Select/etc.).

3. howtoredeemcontent (3-5 steps, each step 12-20 words; HARD MIN 10 words per step):
   - **FORMAT**: Output as <ol> with 4–6 <li> steps (no <ul>)
   - CRITICAL: Start each step with an action verb (imperative voice: Click/Copy/Apply/Confirm/Visit/Navigate/Enter/etc.).
   - **DO NOT use "promo code" here** - use "discount", "offer", "code" (without "promo") instead.
   - Use full sentences; avoid fragments. Aim for ~15 words per step to avoid under-runs.
   - Format as <ol> ordered list for clear step-by-step guidance.
   - Conditional platform mention: if on whop.com, you may mention "Whop.com" in redemption steps.

4. termscontent (80-120 words total, 3-5 concise bullets):
   - Include mention of expiry, usage limits, or platform terms (conditional).
   - **DO NOT use "promo code" here** - use "discount", "offer", "deal" instead.
   - Example bullet: "Discounts may vary by creator or course category."
   - Keep tone informative but not restrictive.

5. faqcontent (ARRAY of 4-6 FAQ objects, Schema.org FAQPage optimized):
   - CRITICAL: Return as JSON array: [{"question": "...", "answerHtml": "..."}, ...]
   - Each answer: 40-70 words, friendly, complete sentences.
   - NEVER single-word replies ("Yes", "No"). Always explain and expand.
   - Cover topics like: "How do I use \${safeName} discounts?", "Can I stack multiple offers?", "Is this deal legitimate?".
   - **CRITICAL: NEVER include the exact phrase "promo code" in FAQ questions or answers. Use "discount", "offer", "current deal", "saving" instead to avoid keyword stuffing.**
   - CRITICAL: Vary question openers (≥3 distinct when n≥4: How/What/Can/Where/Is/Do/etc.). Avoid repetitive "How do I..." patterns.
   - Include semantic variations of target keywords naturally.
   - **GROUNDING REQUIREMENT**: Each FAQ answer SHOULD include at least one verbatim quoted sentence from EVIDENCE (in quotes) followed by "(Verified on [hostname])" when facts are available. If EVIDENCE is insufficient for a specific question, write: "We couldn't verify this from the available sources."

FORMATTING RULES:
- Use HTML <p>, <ul>, <ol>, <li>, and <strong> tags correctly for SEO structure.
- Vary paragraph and sentence lengths for human readability.
- Avoid filler words, repetition, and AI-sounding phrasing.
- Output strictly valid JSON (object only, no markdown).
- Keys must be exactly: slug, aboutcontent, howtoredeemcontent, promodetailscontent, termscontent, faqcontent.
- CRITICAL: faqcontent MUST be an array of objects with "question" (string) and "answerHtml" (string) keys.

E-E-A-T SIGNALS:
- If on whop.com, you may reference it as "a well-known creator platform" or "established marketplace".
- Use expert, authoritative tone without being promotional.
- Provide complete, helpful information that builds user trust.

HUMAN CADENCE STYLE PRIMER:

For all prose fields (aboutcontent, FAQ answers, redemption steps):
Write with *natural human rhythm*. Aim for mixed sentence lengths:
- Short: 8–12 words
- Medium: 13–20 words
- Occasional long: 22–28 words
The mean should be 14–20, with at least one short and one long sentence per paragraph.

Avoid robotic repetition. Vary opening phrases:
- Instead of always starting with "The", use "With", "By", "Using", "In", "For", etc.
Vary punctuation: include occasional commas, em-dashes, and parenthetical clauses.
Use contractions where appropriate ("it's", "you're") to mimic natural writing.

Example (PASS):
  "With AI Video Labs, you'll discover practical tools that make editing seamless.
   The platform's dashboard is intuitive, yet powerful—ideal for creators who want speed without losing quality."

Example (FAIL):
  "AI Video Labs is a course on video editing. It helps you edit videos. It has many tools."

Grade level: 8–10 (readable, not simplistic).

CRITICAL LENGTH REQUIREMENTS - DO NOT STOP EARLY:
Ensure all prose fields strictly meet the required word counts:
- aboutcontent: 130–170 words (HARD MINIMUM 120) - Write 2–3 complete paragraphs
- promodetailscontent: 100–150 words (HARD MINIMUM 100) - Include 3–5 detailed bullet points
- howtoredeemcontent: 3–5 steps, each step 12–20 words (HARD MINIMUM 10 words per step)
- termscontent: 80–120 words (HARD MINIMUM 80) - Write 3–5 informative bullets
- faqcontent: 4–6 FAQ objects, each answer 40–70 words (HARD MINIMUM 40 words per answer)

If you produce fewer words than required, continue writing naturally until you meet the minimum.
Never stop early for brevity or conciseness. Your output will be validated against these exact thresholds.

SELF-CHECK BEFORE RETURNING JSON:
At the end of each section, quickly review your writing:
- Does it sound human and varied (not monotone or repetitive)?
- Are there both short and long sentences?
- Did you follow ALL the hard minimums (aboutcontent ≥120 words, each step ≥10 words)?
- Did you use "\${safeName} promo code" ONLY ONCE in aboutcontent and avoid "promo code" everywhere else?
If not, rewrite that section before returning your JSON.`;

const makeUserPrompt = ({ slug, name, existing, evidence }) => {
  const safeName = (name || slug || "").toString().trim();

  // Check which fields are already filled
  const hasAbout = existing?.about && String(existing.about).trim().length > 0;
  const hasRedeem = existing?.redeem && String(existing.redeem).trim().length > 0;
  const hasDetails = existing?.details && String(existing.details).trim().length > 0;
  const hasTerms = existing?.terms && String(existing.terms).trim().length > 0;
  const hasFaq = Array.isArray(existing?.faq) && existing.faq.length > 0;

  // Build evidence chunks with prompt token safety clamp
  const ev = evidence || {};
  const evChunksRaw = [
    ev.title,
    ev.h1,
    ...(ev.bullets || []),
    ...(ev.paras || []),
    ...(ev.faq?.map(x => `Q:${x.question} A:${x.answer}`) || [])
  ].filter(Boolean).slice(0, 300); // bound count

  // Extra guard: cap total characters and per-chunk length
  let runningChars = 0;
  const evChunks = [];
  for (const s of evChunksRaw) {
    if (runningChars > 8000) break; // total char limit
    const capped = String(s).slice(0, 500); // cap per-chunk
    evChunks.push(capped);
    runningChars += capped.length;
  }

  // Determine if source is on whop.com for conditional keywords
  const sourceUrl = ev.finalUrl || ev.baseUrl || "";
  let isWhopHost = false;
  try {
    if (sourceUrl) isWhopHost = new URL(sourceUrl).hostname.endsWith("whop.com");
  } catch (_) { isWhopHost = false; }

  // Check if "verified" appears in evidence text
  const evidenceText = evChunks.join(" ").toLowerCase();
  const hasVerified = evidenceText.includes("verified") || evidenceText.includes("verification");

  return `
Write SEO-optimized JSON for this listing, using ONLY the EVIDENCE below.
If a claim is not in EVIDENCE, omit it or say "confirm at checkout".

LISTING DETAILS:
slug: ${slug}
displayName: ${safeName}
sourceUrl: ${sourceUrl}
isWhopHost: ${isWhopHost}

TARGET KEYWORDS (critical SEO hierarchy):
- Primary (MUST use): "${safeName} promo code" (exactly once in aboutcontent first paragraph)
  → This is the #1 search term users type. Whop.com uses "promo code" terminology, not "discount".
- Secondary (optional): "save on ${safeName}", "${safeName} discount", "current offer", "special offer" (≤2 combined across all sections)
  → Use these for variety and semantic richness, but "promo code" is primary.
${isWhopHost ? '- Conditional platform keyword: "Whop" or "Whop.com" (use once if on whop.com)' : '- Platform mention: avoid "Whop" (source not on whop.com)'}
${hasVerified ? '- "verified" appears in EVIDENCE, so you may use it if appropriate' : '- "verified" not in EVIDENCE: avoid that word'}

Existing content policy:
aboutcontent: ${hasAbout ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 130-170 words (HARD MIN 120), MUST include '${safeName} promo code' in first paragraph]"}
howtoredeemcontent: ${hasRedeem ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 3-5 steps, each step 12-20 words (HARD MIN 10)]"}
promodetailscontent: ${hasDetails ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 100-150 words]"}
termscontent: ${hasTerms ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 80-120 words]"}
faqcontent: ${hasFaq ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 3-6 FAQs, 40-70 words/answer]"}

EVIDENCE (ordered, truncated):
${evChunks.map((s, i) => `[${i + 1}] ${s}`).join("\n")}

SEO WRITING GUIDELINES:
- aboutcontent: MUST include "${safeName} promo code" naturally in first paragraph. ${isWhopHost ? 'You may mention "Whop" once.' : 'Do not mention Whop.'} End with varied CTA.
- promodetailscontent: Use "current offer", "special offer", or "${safeName} discount" as secondary keywords. ${hasVerified ? 'You may use "verified" if appropriate.' : 'Avoid "verified".'} Focus on value props.
- howtoredeemcontent: Each step must be 12-20 words (HARD MIN 10). ${isWhopHost ? 'You may mention "Whop.com" once in redemption steps.' : 'Do not mention Whop.com.'} Use full sentences.
- termscontent: Include expiry, usage limits${isWhopHost ? ', or platform terms' : ''}. Optionally use one secondary keyword.
- faqcontent: MUST be array format: [{"question":"...", "answerHtml":"..."}]. Complete 40-70 word answers. Never "Yes"/"No" only. Cover common questions about promo codes, stacking offers, deal legitimacy.
- Keyword density: primary ("${safeName} promo code") ≤1 per section; secondary ("discount", "offer", etc.) ≤2 combined per section.

FORMATTING:
- Use only <p>, <ul>, <ol>, <li>, <strong>, <em> in HTML strings.
- Vary sentence lengths for readability (avoid AI staccato).
- Write at Grade 8-10 English level.
- For fields marked PRESENT, return minimal placeholder. System will preserve existing content.

Return single JSON object with exact keys: slug, aboutcontent, howtoredeemcontent, promodetailscontent, termscontent, faqcontent.

EXAMPLE JSON STRUCTURE:
{
  "slug": "example-slug",
  "aboutcontent": "<p>HTML content...</p>",
  "howtoredeemcontent": "<ol><li>Step 1</li></ol>",
  "promodetailscontent": "<ul><li>Benefit 1</li></ul>",
  "termscontent": "<ul><li>Term 1</li></ul>",
  "faqcontent": [
    {"question": "How do I...", "answerHtml": "<p>You can...</p>"},
    {"question": "What is...", "answerHtml": "<p>It is...</p>"}
  ]
}
`;
};

// ------- IO helpers -------
const isJsonl = IN.toLowerCase().endsWith(".jsonl");
const isCsv = IN.toLowerCase().endsWith(".csv");

function parseCsvLine(line) {
  // Minimal CSV parser for common cases (quotes + commas + newlines already split per line).
  // Assumes no multiline fields (export without embedded newlines).
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cur += ch;
    } else {
      if (ch === '"') { inQ = true; continue; }
      if (ch === ',') { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsv(pathCsv) {
  const txt = fs.readFileSync(pathCsv, "utf8");
  const lines = txt.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const idx = Object.fromEntries(headers.map((h,i)=>[h,i]));
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    const cols = parseCsvLine(lines[i]);
    const o = {};
    for (const h of headers) o[h] = cols[idx[h]] ?? "";
    rows.push(o);
  }
  return rows;
}

// ------- Load data -------
let rows = [];
if (isJsonl) {
  const rl = readline.createInterface({ input: fs.createReadStream(IN, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch(e) { console.error("Bad JSONL line, skipping"); continue; }
    rows.push(obj);
  }
} else if (isCsv) {
  rows = readCsv(IN);
} else {
  console.error("Input must be .jsonl or .csv");
  process.exit(1);
}

// Normalize fields we need
function pickRow(r) {
  const slug = (r.slug ?? r.SLUG ?? r.Slug ?? "").toString().trim();
  const name = (r.name ?? r.Name ?? r.title ?? r.Title ?? "").toString().trim();
  const url = (
    r.url ?? r.URL ?? r.affiliateLink ?? r.affiliate_url ?? r.link ?? r.href ?? ""
  ).toString().trim();
  return { slug, name, url,
    about: r.aboutContent ?? r.aboutcontent,
    redeem: r.howtoRedeemContent ?? r.howtoredeemcontent,
    details: r.promoDetailsContent ?? r.promodetailscontent,
    terms: r.termsContent ?? r.termscontent,
    faq: r.faqContent ?? r.faqcontent
  };
}

rows = rows.map(pickRow).filter(r => r.slug);

// Skip already filled (optional)
if (SKIP_FILLED) {
  rows = rows.filter(r => !(r.about && r.redeem && r.details && r.terms && r.faq));
}

if (!isFinite(LIMIT) || LIMIT < rows.length) rows = rows.slice(0, LIMIT);

console.log(`Found ${rows.length} rows to generate from ${IN} (provider=${PROVIDER}, model=${MODEL}).`);

const USAGE_FILE = "data/content/.usage.json";

// Initialize checkpoint (keep legacy structure)
const FORCE = args.force || args.overwrite || process.env.FORCE_REGENERATE === "1";
const RETRY_REJECTS = Boolean(args.retryRejects);

// Toggles for targeted retry runs (bypass normal guards)
const IGNORE_CHECKPOINT = process.env.IGNORE_CHECKPOINT === "1";
const ALLOW_OVERWRITE = process.env.ALLOW_OVERWRITE === "1";
const EVIDENCE_ONLY = process.env.EVIDENCE_ONLY === "1";
const EVIDENCE_MIN_CHARS = +(process.env.EVIDENCE_MIN_CHARS || 600);
const RELAX_GUARDRAILS = process.env.RELAX_GUARDRAILS === "1";
const MIN_EVIDENCE_CHARS = +(process.env.MIN_EVIDENCE_CHARS || 800);
const RELAXED_MIN_EVIDENCE_CHARS = +(process.env.RELAXED_MIN_EVIDENCE_CHARS || 350);
const MAX_RETRIES = +(process.env.MAX_RETRIES || 3);

// Soft-404 detection toggles
const PROBE_ON_404 = process.env.PROBE_ON_404 !== "0";  // default ON
const SOFT404_MIN_LEN = +(process.env.SOFT404_MIN_LEN || 5000);  // bytes of HTML to treat as likely soft-404
const SOFT404_PHRASES = (process.env.SOFT404_PHRASES || "404,not found,page not found,doesn't exist,not-found").split(",");

// HTML debug capture toggle
const SAVE_HTML_DEBUG = process.env.SAVE_HTML_DEBUG === "1";

// Policy-driven guardrails (without weakening evidence globally)
const RULESET = process.env.RULESET || "strict"; // "strict" | "relaxed-spa" | "must-succeed"
const GUARDRAIL_POLICY = {
  "strict": {
    aboutMinWords: 120,
    faqMin: 4,
    evidenceChars: 800,
    name: "Strict (default)"
  },
  "relaxed-spa": {
    aboutMinWords: 70,
    faqMin: 3,
    evidenceChars: 300,
    name: "Relaxed for SPAs"
  },
  "must-succeed": {
    aboutMinWords: 40,
    faqMin: 1,
    evidenceChars: 100,
    maxRetries: 8,
    allowSynthetic: true,
    allowLowConfidence: true,
    retryUntilSuccess: true,
    name: "Must-succeed (retry until success or terminal 404)"
  },
};
const ACTIVE_POLICY = GUARDRAIL_POLICY[RULESET] || GUARDRAIL_POLICY["strict"];
console.log(`📋 Active guardrail policy: ${ACTIVE_POLICY.name}`);

// Override MAX_RETRIES if policy specifies it
const EFFECTIVE_MAX_RETRIES = ACTIVE_POLICY.maxRetries || MAX_RETRIES;
if (ACTIVE_POLICY.maxRetries && ACTIVE_POLICY.maxRetries !== MAX_RETRIES) {
  console.log(`🔄 Policy overrides MAX_RETRIES: ${MAX_RETRIES} → ${ACTIVE_POLICY.maxRetries}`);
}

let ck = loadJSON(CHECKPOINT, { done: {}, pending: {} });
if (!ck.rejected) ck.rejected = {}; // Track rejects separately from done

// Helper to detect prior FAQ grounding failures
function priorFaqGroundingFailed(slug) {
  try {
    const rec = ck?.rejected?.[slug];
    if (!rec) return false;
    const err = (rec.reason || rec.error || "").toLowerCase();
    return /faq answer not grounded|grounding.*faq/.test(err);
  } catch { return false; }
}

// Retry state tracking (prevent infinite loops)
const RETRY_STATE = "data/content/retry-counts.json";
let retries = {};
try { if (fs.existsSync(RETRY_STATE)) retries = JSON.parse(fs.readFileSync(RETRY_STATE, "utf8")); } catch {}
function bumpRetry(slug) {
  retries[slug] = (retries[slug] || 0) + 1;
  fs.writeFileSync(RETRY_STATE, JSON.stringify(retries, null, 2));
  return retries[slug];
}

// Periodic consolidation tracking
let _successesSinceConsolidate = 0;
const CONSOLIDATE_EVERY = +(process.env.CONSOLIDATE_EVERY || 50);

// Success set cache (for write-path guards)
let _succSet = null;
function successSet() {
  if (_succSet) return _succSet;
  _succSet = new Set(
    fs.readFileSync("data/content/master/successes.jsonl","utf8")
      .trim().split("\n").filter(Boolean)
      .map(l => { try { return JSON.parse(l).slug } catch { return null }})
      .filter(Boolean)
  );
  return _succSet;
}

// Remove any stale reject entry when a success is written
function removeRejectIfExists(slug) {
  const p = "data/content/master/rejects.jsonl";
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, "utf8").split("\n");
  let changed = false;
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.slug === slug) { changed = true; continue; }
      out.push(line);
    } catch { out.push(line); }
  }
  if (changed) {
    const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, out.join("\n") + "\n");
    const fd = fs.openSync(tmp, "r");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmp, p);
    // Update cache
    if (_succSet) _succSet.add(slug);
  }
}

// Prune stale pending entries (from crashed runs)
const MAX_PENDING_AGE_MS = 30 * 60 * 1000; // 30 min
const now = Date.now();
for (const [slug, ts] of Object.entries(ck.pending || {})) {
  if (!ts || now - Number(ts) > MAX_PENDING_AGE_MS) delete ck.pending[slug];
}

// Load fingerprints for deduplication
const fingerprints = loadFingerprints();

// Helper to persist checkpoint
function persistCheckpoint() {
  saveJSON(CHECKPOINT, ck);
}

// Helper to reject and persist (separate from done)
function rejectAndPersist(slug, reason, meta = {}) {
  // HARD GUARD: if slug is already a success, do NOT write a reject
  if (successSet().has(slug)) {
    console.warn(`⚠️  Skip reject for ${slug}: already in successes`);
    return;
  }

  // Classify error into machine-readable errorCode
  const reasonStr = String(reason || 'unknown');
  const code = (
    meta.errorCode ||
    (/404/i.test(reasonStr)                    ? "HTTP_404" :
     /evidence.*insufficient/i.test(reasonStr) ? "INSUFFICIENT_EVIDENCE" :
     /fetch failed/i.test(reasonStr)           ? "NETWORK_FETCH_FAIL" :
     /guardrail/i.test(reasonStr)              ? "GUARDRAIL_FAIL" :
     /grounding check failed/i.test(reasonStr) ? "GUARDRAIL_FAIL" :
     /repair failed/i.test(reasonStr)          ? "GUARDRAIL_FAIL" :
     /primary keyword.*missing/i.test(reasonStr) ? "GUARDRAIL_FAIL" :
     /rate.*limit/i.test(reasonStr)            ? "RATE_LIMIT" :
     /timeout/i.test(reasonStr)                ? "TIMEOUT" :
                                                 "OTHER")
  );

  // Must-succeed mode: only reject terminal 404s, never quality/retry errors
  if (ACTIVE_POLICY.retryUntilSuccess) {
    const retryableErrors = ["INSUFFICIENT_EVIDENCE", "NETWORK_FETCH_FAIL", "GUARDRAIL_FAIL", "RATE_LIMIT", "TIMEOUT", "OTHER"];
    if (retryableErrors.includes(code)) {
      console.log(`🔄 Must-succeed mode: skipping reject for retryable error ${code} on ${slug}`);
      // Don't persist reject - this will cause retry on next pass
      delete ck.pending[slug]; // But do clear pending state
      persistCheckpoint();
      return;
    }
    // Only HTTP_404 and ABANDONED are terminal in must-succeed mode
    if (code !== "HTTP_404" && code !== "ABANDONED") {
      console.log(`🔄 Must-succeed mode: deferring reject for ${code} on ${slug}`);
      delete ck.pending[slug];
      persistCheckpoint();
      return;
    }
  }

  ck.rejected[slug] = { reason: reasonStr, errorCode: code, ts: Date.now(), meta };
  delete ck.pending[slug];
  persistCheckpoint();

  // IMMEDIATE APPEND to master rejects (crash-safe)
  // Skip if in EVIDENCE_ONLY mode (we're just probing, not finalizing)
  if (!EVIDENCE_ONLY) {
    try {
      const rejectEntry = { slug, error: reasonStr, errorCode: code, meta, ts: new Date().toISOString() };
      fs.appendFileSync("data/content/master/rejects.jsonl", JSON.stringify(rejectEntry) + "\n");
    } catch (err) {
      console.error(`⚠️  Failed to append reject to master: ${err.message}`);
    }
  }
}

// Helper to check if existing content is sufficient (skip token spend)
function hasSufficientContent(existing) {
  if (!existing) return false;
  const textLen = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim().length : 0);
  const okAbout = textLen(existing.about || existing.aboutcontent) >= 80;
  const okRedeem = /<li/i.test(existing.redeem || existing.howtoredeemcontent || '');
  const okPromo = /<li/i.test(existing.details || existing.promodetailscontent || '');
  const okTerms = /<li/i.test(existing.terms || existing.termscontent || '');
  const okFaq = Array.isArray(existing.faq || existing.faqcontent)
    ? (existing.faq || existing.faqcontent).length >= 3
    : /\[.*\{/.test(existing.faq || existing.faqcontent || ''); // tolerate stored JSON string
  return okAbout && okRedeem && okPromo && okTerms && okFaq;
}

// Save cleaned checkpoint
persistCheckpoint();

// Track already done slugs (for resume logic unless FORCE)
const alreadyDone = new Set(Object.keys(ck.done || {}));

// Generate output file paths (collision-proof with timestamp + pid + random suffix)
if (!ck.outPath || !ck.rejPath) {
  // Use RUN_ID from env if provided (for run-scoped naming), otherwise generate unique ID
  let stamp;
  if (process.env.RUN_ID) {
    stamp = process.env.RUN_ID;
  } else {
    // Create unique, collision-proof run ID: YYYYMMDDhhmmss-pid-random
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14); // YYYYMMDDhhmmss
    const pid = process.pid;
    const rnd = crypto.randomBytes(4).toString("hex");
    stamp = `${ts}-${pid}-${rnd}`;
  }

  ck.outPath = path.join(OUT_DIR, `ai-run-${stamp}.jsonl`);
  ck.rejPath = path.join(OUT_DIR, `rejects-${stamp}.jsonl`);
  ck.runMeta = path.join(OUT_DIR, `ai-run-${stamp}.meta.json`);
  persistCheckpoint();
}
const OUT_FILE = ck.outPath;
const REJECTS_FILE = ck.rejPath;
const RUN_META = ck.runMeta || path.join(OUT_DIR, `ai-run-fallback.meta.json`);

// Initialize output files with exclusive create (fail if file exists - collision prevention)
try {
  if (!fs.existsSync(OUT_FILE)) {
    const fd = fs.openSync(OUT_FILE, "wx"); // Exclusive create - throws if exists
    fs.closeSync(fd);
  }
  if (!fs.existsSync(REJECTS_FILE)) {
    const fd = fs.openSync(REJECTS_FILE, "wx"); // Exclusive create - throws if exists
    fs.closeSync(fd);
  }
} catch (err) {
  if (err.code === "EEXIST") {
    console.error(`❌ Fatal: Output file collision detected. File already exists.`);
    console.error(`   This should never happen with collision-proof naming.`);
    console.error(`   OUT_FILE: ${OUT_FILE}`);
    process.exit(99);
  }
  throw err;
}

// Write run metadata
if (!fs.existsSync(RUN_META)) {
  fs.writeFileSync(RUN_META, JSON.stringify({
    startedAt: new Date().toISOString(),
    provider: PROVIDER,
    model: MODEL,
    strongModel: STRONG_MODEL || null,
    inputFile: IN,
    batch: CONCURRENCY,
    limit: LIMIT,
    budgetUsd: BUDGET_USD || null
  }, null, 2));
}

// Only allow these tags inside any HTML fields
const ALLOWED_TAGS = new Set(["p","ul","ol","li","strong","em"]);

// Atomic write helper (reduces chance of monitor reading partial file)
function writeJsonAtomic(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function sanitizeHtml(html) {
  if (typeof html !== "string") return "";

  // Remove entire script/style blocks (tags + contents)
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Remove on* handlers: double quotes, single quotes, and unquoted
  html = html.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // Strip dangerous URI schemes: double, single, unquoted
  html = html.replace(/\s(href|src)\s*=\s*"(?:javascript|data):[^"]*"/gi, "");
  html = html.replace(/\s(href|src)\s*=\s*'(?:javascript|data):[^']*'/gi, "");
  html = html.replace(/\s(href|src)\s*=\s*(?:javascript|data):[^\s>]+/gi, "");

  // Drop inline styles entirely (avoid CSS injection)
  html = html.replace(/\sstyle\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\sstyle\s*=\s*'[^']*'/gi, "");

  // Strip disallowed tags but keep inner text
  return html.replace(/<\/?([a-z0-9:-]+)(\s[^>]*)?>/gi, (m, tag) => {
    tag = String(tag).toLowerCase();
    return ALLOWED_TAGS.has(tag) ? m : "";
  });
}

function wrapLis(html) {
  // Wrap lone <li> items with <ul> if no list wrapper exists
  if (!html) return html;
  const hasList = /<\s*(ul|ol)\b/i.test(html);
  const hasLi = /<\s*li\b/i.test(html);
  if (hasLi && !hasList) return `<ul>${html}</ul>`;
  return html;
}

function normalizeSpaces(s) {
  // Normalize Unicode spaces and collapse whitespace
  return String(s || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars (ZWSP, ZWJ, ZWNJ, BOM)
    .replace(/\u00A0/g, " ")                // nbsp → space
    .replace(/\s+/g, " ")                   // collapse multiple spaces
    .trim();
}

function normalizeContent(html) {
  // Normalize whitespace + punctuation post-sanitize (keeps word counts stable)
  let t = String(html || "");
  t = t.replace(/\s+/g, " ");              // collapse whitespace
  t = t.replace(/([!?.,])\1+/g, "$1");     // collapse repeated punctuation (e.g., "!!!" → "!")
  return t.trim();
}

function sanitizePayload(obj) {
  obj.aboutcontent = normalizeContent(normalizeSpaces(sanitizeHtml(obj.aboutcontent)));
  obj.howtoredeemcontent = normalizeContent(normalizeSpaces(wrapLis(sanitizeHtml(obj.howtoredeemcontent))));
  obj.promodetailscontent = normalizeContent(normalizeSpaces(wrapLis(sanitizeHtml(obj.promodetailscontent))));
  obj.termscontent = normalizeContent(normalizeSpaces(wrapLis(sanitizeHtml(obj.termscontent))));
  if (Array.isArray(obj.faqcontent)) {
    obj.faqcontent = obj.faqcontent.map(it => ({
      question: normalizeContent(normalizeSpaces(String(it?.question ?? ""))),
      answerHtml: normalizeContent(normalizeSpaces(sanitizeHtml(String(it?.answerHtml ?? "")))),
    }));
  }
  return obj;
}

// ============================================================================
// Self-healing normalisation & repair helpers
// ============================================================================

function ensureOrderedList(html) {
  if (!html) return html;
  const hasOl = /<ol[\s>]/i.test(html);
  if (hasOl) return html;

  // 1) Try converting an <ul> into an <ol>
  if (/<ul[\s>]/i.test(html)) {
    return html
      .replace(/<ul([^>]*)>/ig, '<ol$1>')
      .replace(/<\/ul>/ig, '</ol>');
  }

  // 2) Otherwise split plain text into 4–6 steps and wrap
  const text = html
    .replace(/<\/?p>/ig, '\n')
    .replace(/<br\s*\/?>/ig, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  const lines = text.length >= 4 ? text.slice(0, 6) : (text.join(' ').match(/[^.?!]+[.?!]/g) || []).slice(0,6);
  if (lines.length === 0) return html;

  const items = lines.map(s => `<li>${s}</li>`).join('');
  return `<ol>\n${items}\n</ol>`;
}

function ensureParagraphs(html, min=2) {
  if (!html) return html;
  // If already contains <p>, keep; else wrap sentences/blocks
  if (/<p[\s>]/i.test(html)) return html;
  const sentences = html
    .replace(/<br\s*\/?>/ig, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n{2,}|(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map(s => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return html;
  const paras = (sentences.length < min ? [sentences.join(' ')] : sentences).slice(0, Math.max(min, 3));
  return paras.map(p => `<p>${p}</p>`).join('\n');
}

function clampListItems(html, min=4, max=7) {
  if (!html) return html;
  const m = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
  if (!m) return html;
  const lis = [...m[1].matchAll(/<li[\s>][\s\S]*?<\/li>/ig)].map(x => x[0]);
  if (lis.length === 0) return html;
  const picked = lis.slice(0, Math.max(min, Math.min(max, lis.length)));
  const wrapped = `<ol>\n${picked.join('\n')}\n</ol>`;
  return html.replace(/<ol[^>]*>[\s\S]*?<\/ol>/i, wrapped);
}

function ensureUnorderedList(html) {
  if (!html) return html;
  if (/<ul[\s>]/i.test(html)) return html;
  // convert any <ol> to <ul>
  if (/<ol[\s>]/i.test(html)) return html.replace(/<ol([^>]*)>/ig,'<ul$1>').replace(/<\/ol>/ig,'</ul>');
  // fallback: split lines → bullets
  const lines = html.replace(/<br\s*\/?>/ig, '\n').replace(/<[^>]+>/g,'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
  if (lines.length === 0) return html;
  const items = lines.slice(0,7).map(s=>`<li>${s}</li>`).join('');
  return `<ul>\n${items}\n</ul>`;
}

function toSafeName(name) {
  return (name || "").replace(/[^\w\s\-]/g, "").replace(/\s+/g," ").trim();
}

function ensurePrimaryKeyword(aboutHtml, safeName) {
  if (!aboutHtml) return aboutHtml;
  const exact = `${safeName} promo code`;
  const hasPK = new RegExp(`\\b${exact.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\b`, "i").test(aboutHtml);
  if (hasPK) return aboutHtml;

  let html = aboutHtml;
  if (!/<p[\s>]/i.test(html)) {
    const sentences = html
      .replace(/<br\s*\/?>/ig, "\n").replace(/<[^>]+>/g, "")
      .split(/\n{2,}|(?<=[.?!])\s+(?=[A-Z0-9])/).map(s=>s.trim()).filter(Boolean);
    html = sentences.map(s=>`<p>${s}</p>`).join("\n");
  }

  html = html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/i, (_m, attrs, inner) => {
    const cleanInner = inner.trim();
    const joiner = /[.?!]$/.test(cleanInner) ? " " : ". ";
    const injected = `${cleanInner}${joiner}${exact} is available here.`;
    return `<p${attrs}>${injected}</p>`;
  });

  return html;
}

function normaliseOutput(output, { isKnownSPA=false, __safeName=null } = {}) {
  const o = { ...output };

  // aboutcontent: guarantee <p> paragraphs (2–3)
  o.aboutcontent = ensureParagraphs(o.aboutcontent, 2);

  // Inject primary keyword if missing
  const safe = toSafeName(__safeName || o.name || o.slug || "");
  o.aboutcontent = ensurePrimaryKeyword(o.aboutcontent, safe);

  // howtoredeemcontent: force <ol> and sane count
  o.howtoredeemcontent = clampListItems(ensureOrderedList(o.howtoredeemcontent), 4, 6);

  // promodetailscontent / termscontent: prefer <ul>/<li>
  o.promodetailscontent = ensureUnorderedList(o.promodetailscontent);
  o.termscontent = ensureUnorderedList(o.termscontent);

  // FAQ: ensure array shape with non-empty answers
  if (!Array.isArray(o.faqcontent)) o.faqcontent = [];
  o.faqcontent = o.faqcontent
    .filter(x => x && x.question && x.answerHtml)
    .slice(0, 6);

  // Optional: if SPA and meta-only, mark for lenient treatment
  if (isKnownSPA) o.__spa_ok = true;

  return o;
}

// ============================================================================

function validatePayload(obj) {
  const required = ["slug","aboutcontent","howtoredeemcontent","promodetailscontent","termscontent","faqcontent"];
  for (const k of required) {
    if (!(k in obj)) return `Missing key: ${k}`;
  }
  // FAQ must be an array of 4–6 objects with question + answerHtml
  if (!Array.isArray(obj.faqcontent)) return "faqcontent must be an array";
  if (obj.faqcontent.length < 4 || obj.faqcontent.length > 6) return "faqcontent must have 4–6 items";
  for (const i of obj.faqcontent) {
    if (!i || typeof i.question !== "string" || typeof i.answerHtml !== "string") {
      return "faqcontent items must be {question:string, answerHtml:string}";
    }
  }
  return null;
}

// --- Hard structure/length constraints (SEO targets from top-ranking pages) ---
const TARGETS = {
  // aboutcontent: 120-180 words, 2-3 paragraphs
  aboutParagraphsMin: 2, aboutParagraphsMax: 3,
  aboutWordsMin: 120, aboutWordsMax: 180,

  // howtoredeemcontent: 3-5 steps, each 10-20 words
  redeemStepsMin: 3, redeemStepsMax: 5,
  redeemStepWordsMin: 10, redeemStepWordsMax: 20,

  // promodetailscontent: 100-150 words, 3-5 bullets
  detailsBulletsMin: 3, detailsBulletsMax: 5,
  detailsWordsMin: 100, detailsWordsMax: 150,

  // termscontent: 80-120 words, 3-5 bullets
  termsBulletsMin: 3, termsBulletsMax: 5,
  termsWordsMin: 80, termsWordsMax: 120,

  // faqcontent: 3-6 FAQs, each answer 40-70 words (Schema.org FAQPage)
  faqCountMin: 3, faqCountMax: 6,
  faqAnswerWordsMin: 40, faqAnswerWordsMax: 70,
};

function countTags(html, tag) {
  if (!html) return 0;
  const re = new RegExp(`<${tag}\\b`, "gi");
  return (html.match(re) || []).length;
}

function countWords(html) {
  // Use tokenizer logic (same as similarity checks) for accurate word counts
  return tokens(stripTags(String(html || ""))).length;
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
}

// Simple word count for padding enforcement (no tokenizer)
function wordCount(html) {
  const t = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.split(/\s+/).length : 0;
}

// Append neutral padding sentences inside the LAST <li> without changing bullet count
function padUlToWordCount(ulHtml, minWords, padSentences) {
  if (!ulHtml) return ulHtml;
  const current = wordCount(ulHtml);
  if (current >= minWords) return ulHtml;

  // Find last <li>...</li>
  const liRegex = /(<li\b[^>]*>)([\s\S]*?)(<\/li>)(?![\s\S]*<li\b)/i;
  const m = ulHtml.match(liRegex);
  if (!m) return ulHtml;

  let [full, open, inner, close] = m;
  let extra = '';
  let idx = 0;

  // Keep adding short, policy-safe padding until we hit minWords
  let working = ulHtml;
  while (wordCount(working) < minWords) {
    const s = padSentences[idx % padSentences.length];
    extra += (inner.trim().endsWith('.') ? ' ' : '. ') + s;
    idx++;
    const newInner = inner + extra;
    working = ulHtml.replace(liRegex, `${open}${newInner}${close}`);
    if (idx > 50) break; // safety
  }
  return working;
}

// --- Step-level helpers for <li> expansion ---

function splitListItems(html) {
  // naive but robust: captures <li>...</li> blocks
  return (String(html).match(/<li[\s\S]*?<\/li>/gi) || []);
}

function replaceListItem(html, index1, newItemHtml) {
  const items = splitListItems(html);
  if (!items.length || index1 < 1 || index1 > items.length) return html;
  // Replace only the nth occurrence
  let seen = 0;
  return String(html).replace(/<li[\s\S]*?<\/li>/gi, (m) => {
    seen += 1;
    return seen === index1 ? newItemHtml : m;
  });
}

function innerTextFromLi(liHtml) {
  // strip tags for counting words
  return String(liHtml).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function appendPhraseToLi(liHtml, phrase) {
  // Insert just before closing </li>, preserving existing HTML
  return liHtml.replace(/<\/li>\s*$/i, ` ${phrase}</li>`);
}

// Small bank of generic, relevant checkout phrases (varied, short)
const STEP_APPEND_PHRASES = [
  "using the on-screen checkout instructions",
  "through your account dashboard at checkout",
  "and verify the code before confirming payment",
  "then continue following the prompts to complete",
  "and apply the code on the payment page before you submit"
];

function pickAppendPhrase(i = 0) {
  return STEP_APPEND_PHRASES[i % STEP_APPEND_PHRASES.length];
}

// --- Primary keyword sanitizer (ban "promo code" outside aboutcontent) ---

function sanitizePrimaryKeywordOutsideAbout(obj, slug = "") {
  const rng = prngSeed(slug || obj.slug || "default");

  const replacePromo = (html) => {
    let callCount = 0;
    return String(html || "").replace(/\bpromo\s+codes?\b/gi, (m) => {
      // rotate synonyms deterministically (seeded per slug)
      const pool = ["discount", "offer", "current deal", "saving"];
      const pick = pool[Math.floor(rng() * pool.length)];
      callCount++;
      return m.toLowerCase().endsWith("s") && pick !== "saving" ? pick + "s" : pick;
    });
  };

  // only sanitize non-about sections
  obj.howtoredeemcontent && (obj.howtoredeemcontent = replacePromo(obj.howtoredeemcontent));
  obj.promodetailscontent && (obj.promodetailscontent = replacePromo(obj.promodetailscontent));
  obj.termscontent && (obj.termscontent = replacePromo(obj.termscontent));

  if (Array.isArray(obj.faqcontent)) {
    obj.faqcontent = obj.faqcontent.map(it => ({
      ...it,
      answerHtml: replacePromo(it.answerHtml),
      question: String(it.question || "").replace(/\bpromo\s+codes?\b/gi, "discounts"),
    }));
  }

  return obj;
}

// --- Imperative bullet enforcer (bullets must start with action verbs) ---

const IMPERATIVE_VERBS = [
  "Use","Copy","Click","Select","Apply","Choose","Check","Redeem","Sign","Create","Start","Join","Open","Visit","Go","Tap","Add"
];

function enforceImperativeBullets(html) {
  if (!html) return html;
  let items = splitListItems(html);
  if (!items.length) return html;

  const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const startsWithVerb = (text) => {
    // Strip leading numerals, bullets, dashes before checking
    const norm = text.replace(/^([\d\)\.\-\–\•\*]+\s*)+/, "");
    const first = (norm.match(/^[A-Za-z']+/) || [""])[0];
    return IMPERATIVE_VERBS.includes(first.charAt(0).toUpperCase()+first.slice(1));
  };

  items = items.map((li) => {
    const raw = stripHtml(li);
    if (startsWithVerb(raw)) return li;
    // minimally fix: prepend "Use " without destroying structure
    return li.replace(/(<li[^>]*>)(\s*)/i, "$1$2Use ");
  });

  // stitch back
  let out = html;
  items.forEach((li, i) => { out = replaceListItem(out, i+1, li); });
  return out;
}

// --- Human cadence enforcer (nudge sentence length variety) ---

function enforceHumanCadence(html, slug = "") {
  if (!html) return html;

  const stripHtmlForSentences = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Split into paragraphs
  const paragraphs = String(html).split(/<\/p>/i).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) return html;

  const rng = prngSeed(slug || "default");
  const transitions = [
    "In addition, this helps ensure better results",
    "More importantly, you'll get consistent value",
    "That said, results may vary by use case",
    "On top of that, the platform offers ongoing support"
  ];

  let fixed = false;
  const enhancedParas = paragraphs.map((para, idx) => {
    if (fixed) return para + "</p>"; // only fix one paragraph max

    const text = stripHtmlForSentences(para);
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length < 2) return para + "</p>";

    const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
    const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

    // If this paragraph is too short/robotic, extend it
    if (avg < 12) {
      const pick = transitions[Math.floor(rng() * transitions.length)];
      fixed = true;
      return para.replace(/\s*$/i, `. ${pick}`) + "</p>";
    }

    return para + "</p>";
  });

  return enhancedParas.join("");
}

// --- Deterministic padders (guarantee minimums without LLM calls) ---

function wordCountPlain(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function splitAtWordBoundary(text, target) {
  const words = text.split(/\s+/);
  if (words.length <= target) return [text, ""];
  const left = words.slice(0, target).join(" ");
  const right = words.slice(target).join(" ");
  return [left, right];
}

function enforceParagraphs(html, { min = 2, max = 3, splitAtWords = 70 } = {}) {
  if (!html) return html;
  const paras = String(html).split(/<\/p>/i).filter(p => p.trim());
  if (paras.length >= min && paras.length <= max) return html;

  if (paras.length === 1) {
    const inner = paras[0].replace(/<p[^>]*>/i, "").trim();
    const [p1, p2rest] = splitAtWordBoundary(inner, splitAtWords);
    const p2 = p2rest.trim();
    if (!p2) return `<p>${inner}</p>`; // nothing to split
    // Allow 2 paragraphs; if very long, split 3rd
    let out = [`<p>${p1}</p>`, `<p>${p2}</p>`];
    if (out.length < min) {
      const [p2a, p2b] = splitAtWordBoundary(p2, Math.floor(splitAtWords / 1.4));
      out = [`<p>${p1}</p>`, `<p>${p2a}</p>`];
      if (p2b.trim()) out.push(`<p>${p2b}</p>`);
    }
    return out.slice(0, max).join("");
  }
  // If too many paragraphs, merge tail until ≤max
  if (paras.length > max) {
    const head = paras.slice(0, max - 1).map(p => `<p>${p}</p>`);
    const tail = paras.slice(max - 1).join(" ");
    return [...head, `<p>${tail}</p>`].join("");
  }
  return html;
}

const PAD_BULLETS_PROMO = [
  "Apply the available discount during checkout to lock in pricing, then review plan details before you confirm on the final screen, including renewal cadence and any usage limits.",
  "Join with the tier that matches your needs, compare what's included across options, and confirm that the features you rely on are part of your selection before you proceed.",
  "Access the current offer to reduce upfront cost while keeping the same features and support, and verify whether the price is promotional, introductory, or ongoing for renewals."
];

const PAD_BULLETS_TERMS = [
  "Discounts and offers may change or end without notice; availability can vary by region, payment method, or creator policy. Always confirm the final price and renewal cadence at checkout.",
  "Some deals cannot be combined with other promotions or trials; check eligibility, refund rules, and platform terms so you understand inclusions, limitations, and cancellation windows."
];

// Neutral padding sentences (appended to last <li> to hit word count targets without adding bullets)
const PAD_PROMO = [
  'Details vary by offer and creator.',
  'Check the offer page for exact inclusions.',
  'Pricing and availability can change.',
  'The coupon applies at checkout when eligible.',
  'Currency is shown for your region.',
  'Plan and tier names may differ over time.',
  'Discounts cannot be combined unless stated.',
  'Renewal terms are shown before purchase.',
];

const PAD_TERMS = [
  'Use is governed by the seller\'s policy on Whop.',
  'Billing terms and renewal cadence are displayed at checkout.',
  'Refund options depend on the creator\'s stated policy.',
  'Regional taxes and currency may apply based on location.',
  'Single-use codes generally cannot be stacked.',
  'Offer details can change without prior notice.',
];

function getListItems(html) {
  return String(html || "").match(/<li[\s\S]*?<\/li>/gi) || [];
}

function setListItems(html, items) {
  if (!html) return `<ul>${items.join("")}</ul>`;
  if (!/<ul/i.test(html)) return `<ul>${items.join("")}</ul>`;
  return html.replace(/<ul[^>]*>[\s\S]*?<\/ul>/i, m => m.replace(/(<ul[^>]*>)[\s\S]*?(<\/ul>)/i, `$1${items.join("")}$2`));
}

function totalWordsInLis(items) {
  return items
    .map(li => li.replace(/<[^>]+>/g, " ").trim())
    .map(t => t.split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
}

function padListToWordCount(
  html,
  {
    minWords,
    maxWords,
    padPool,
    minItems = 3,   // Keep lists between 3–5 items by default
    maxItems = 5
  }
) {
  let items = getListItems(html);
  if (items.length === 0) items = [];

  // 1) Ensure at least minItems bullets before worrying about word count
  let i = 0;
  while (items.length < minItems && i < 10) {
    const pick = padPool[i % padPool.length];
    items.push(`<li>${pick}</li>`);
    i++;
  }

  // 2) Now raise total words to minWords (but never exceed maxItems)
  let total = totalWordsInLis(items);
  i = 0;
  while (total < minWords && items.length < maxItems && i < 10) {
    const pick = padPool[i % padPool.length];
    items.push(`<li>${pick}</li>`);
    total = totalWordsInLis(items);
    i++;
  }

  // 3) Hard cap items at maxItems and ensure we don't wildly exceed maxWords
  if (items.length > maxItems) items = items.slice(0, maxItems);
  if (maxWords) {
    // If we overshot by words, trim back toward maxItems but never below minItems
    while (totalWordsInLis(items) > maxWords && items.length > minItems) {
      items.pop();
    }
  }

  // 4) Last-resort guarantee: if we still haven't hit minWords after maxItems, add one long neutral bullet
  if (totalWordsInLis(items) < minWords) {
    const LONG_PAD = "Compare the plan features and renewal terms carefully, then apply the available discount at checkout to lock in today's pricing. Review billing cadence, platform policies, and access details so you understand exactly what's included before confirming the order.";
    if (items.length < maxItems) {
      items.push(`<li>${LONG_PAD}</li>`);
    } else {
      // replace the last bullet with a longer one to reach the floor
      items[items.length - 1] = `<li>${LONG_PAD}</li>`;
    }
  }

  return setListItems(html, items);
}

const PAD_SENTENCES_FAQ = [
  "Results and eligibility can vary, so review the latest details on the product page.",
  "If you are unsure, compare tiers side by side before choosing the option you prefer.",
  "Policies can change, so confirm the terms at checkout before you complete your order."
];

function padFaqAnswer(answerHtml, { minWords = 40, maxWords = 70 }) {
  let text = String(answerHtml || "");
  const already = new Set(
    PAD_SENTENCES_FAQ.filter(s => text.includes(s))
  );

  const wc0 = wordCountPlain(text);
  if (wc0 >= minWords) return tidyParagraphs(text);

  let out = text.replace(/\s*<\/p>\s*$/i, "");
  let i = 0, tries = 0;

  while (wordCountPlain(out) < minWords && tries < 6) {
    const pick = PAD_SENTENCES_FAQ[i % PAD_SENTENCES_FAQ.length];
    i++; tries++;
    if (already.has(pick)) continue;
    already.add(pick);

    if (/<p[^>]*>[\s\S]*<\/p>/i.test(out)) {
      out = out.replace(/<\/p>\s*$/i, `. ${pick}</p>`);
    } else {
      out = `<p>${out}${out ? ". " : ""}${pick}</p>`;
    }
  }

  // Soft cap if we overshoot maxWords
  while (wordCountPlain(out) > maxWords) {
    out = out.replace(/(?:\.|!|\?)\s*[^.?!<]{5,}\s*(<\/p>)?$/, "$1" );
    if (wordCountPlain(out) <= maxWords) break;
    break;
  }
  return tidyParagraphs(out);
}

function dedupeAdjacentSynonyms(html) {
  return String(html || "")
    .replace(/\b(discount|offer|deal|saving)(\s*,\s*\1)+/gi, "$1")
    .replace(/\b(discount|offer|deal|saving)\s+(discount|offer|deal|saving)\b/gi, "$1");
}

function normalizeImperativeLi(liHtml) {
  // Turn "<li>Use Access ..." into "<li>Access ..."
  return String(liHtml || "").replace(
    /(<li[^>]*>)\s*Use\s+([A-Z][a-z]+)/,
    (_m, open, verb) => `${open}${verb}`
  );
}

function mapListItems(html, mapper) {
  const items = getListItems(html);
  if (items.length === 0) return html;
  const mapped = items.map(mapper);
  return setListItems(html, mapped);
}

function tidyParagraphs(html) {
  let out = String(html || "");
  out = out.replace(/<p>\s*<p>/gi, "<p>");
  out = out.replace(/<\/p>\s*<\/p>/gi, "</p>");
  return out;
}

function keepFirstUl(html) {
  const m = String(html || "").match(/<ul[\s\S]*?<\/ul>/i);
  return m ? m[0] : html; // fallback to original if no UL found
}

function enforceBulletRange(html, { minItems = 3, maxItems = 5, pool = PAD_BULLETS_PROMO }) {
  let items = getListItems(html);
  if (items.length < minItems) {
    let i = 0;
    while (items.length < minItems && i < 10) {
      items.push(`<li>${pool[i % pool.length]}</li>`);
      i++;
    }
    html = setListItems(html, items);
    items = getListItems(html);
  }
  if (items.length > maxItems) {
    items = items.slice(0, maxItems);
    html = setListItems(html, items);
  }
  return html;
}

function ensureImperativeStart(liHtml) {
  let s = String(liHtml || "");

  // Normalize "Use ..." → "Apply ...", "Please ..." → drop politeness
  s = s.replace(/(<li[^>]*>)\s*Use\b/i, (_m, open) => `${open}Apply`);
  s = s.replace(/(<li[^>]*>)\s*Please\s+/i, (_m, open) => `${open}`);

  // If bullet starts with an article/pronoun, prepend "Review "
  s = s.replace(/(<li[^>]*>)\s*(?:The|This|These|You|Your|It|A|An)\b/i, (_m, open) => `${open}Review `);

  // Guard empty bullets
  s = s.replace(/(<li[^>]*>)\s*(<\/li>)/i, (_m, open, close) => `${open}Review details${close}`);

  return s;
}

// --- Cadence & Imperative helpers -------------------------------------------

// Ensure aboutcontent has ≥3 sentences, mean ~13–22 words, stdev ≥4
function varySentenceCadence(html) {
  if (!html) return html;
  // strip tags → sentences
  const text = String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  let parts = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  // If already looks human, bail
  const counts = parts.map(s => s.split(/\s+/).filter(Boolean).length);
  const mean = counts.length ? counts.reduce((a,b)=>a+b,0)/counts.length : 0;
  const sd = counts.length > 1
    ? Math.sqrt(counts.map(c => (c-mean)*(c-mean)).reduce((a,b)=>a+b,0) / (counts.length-1))
    : 0;

  const good = (parts.length >= 3 && mean >= 13 && mean <= 22 && sd >= 4);
  if (good) return html;

  // Otherwise add/adjust cadence via short/medium/long boilerplate sentences
  const pads = [
    "It's worth noting how this offer is typically used by creators in practice.",
    "In most cases, members highlight the clarity of the terms and the consistency of delivery.",
    "For context, pricing and availability can shift during promotions or seasonal events.",
    "Many users prefer comparing tiers before committing, especially when trials are available.",
    "If you're new, start simple, then expand access once you're comfortable with the cadence.",
  ];

  while (parts.length < 3) parts.push(pads[(parts.length) % pads.length]);

  // lightly stretch variance by appending a short or long line
  const SHORT = "Results vary by creator and plan.";
  const LONG  = "Before purchasing, review the plan details, expected renewal dates, and any region-specific notes so you understand how the membership evolves over time.";
  if (sd < 4) {
    parts.push(sd < 2 ? LONG : SHORT);
  }

  const rebuilt = parts.join(" ");
  // restore paragraphs (2–3)
  const para = rebuilt.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
  const chunks = [para.slice(0, Math.ceil(para.length/2)).join(" "), para.slice(Math.ceil(para.length/2)).join(" ")].filter(Boolean);
  return chunks.map(p => `<p>${p}</p>`).join("");
}

// Normalize each <li> to start with a clear imperative verb
function ensureBulletStartsImperative(liHtml) {
  if (!liHtml) return liHtml;
  const inner = liHtml.replace(/^<li[^>]*>/i, "").replace(/<\/li>$/i, "").trim();

  // remove "Please", polite hedges
  let s = inner.replace(/^(please|kindly|you can|you may|try to)\b[\s,]*/i, "");

  const VERBS = [
    "Apply","Redeem","Select","Choose","Confirm","Enter","Remove","Check","Review",
    "Compare","Join","Start","Cancel","Upgrade","Switch","Save","Verify","Follow",
    "Open","Click","Copy","Paste","Add","Proceed","Complete","Use"
  ];

  // If already starts with a verb, capitalize it and return
  const m = s.match(/^([A-Za-z]+)/);
  if (m && VERBS.includes(m[1][0].toUpperCase()+m[1].slice(1).toLowerCase())) {
    const v = m[1][0].toUpperCase()+m[1].slice(1).toLowerCase();
    s = v + s.slice(m[1].length);
  } else {
    // Coerce common non-imperatives
    s = s.replace(/^Use\b/i, "Apply")
         .replace(/^Using\b/i, "Apply")
         .replace(/^You should\b/i, "Apply")
         .replace(/^You must\b/i, "Apply")
         .replace(/^Make sure to\b/i, "Check");
    // If still no verb at start, prefix with Apply
    if (!/^[A-Z][a-z]+/.test(s)) s = "Apply " + s.replace(/^[\-\–•\s]+/, "");
  }

  // Ensure sentence casing and terminal punctuation minimalism
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\.\s*$/, ""); // bullets don't need trailing period for consistency

  return `<li>${s}</li>`;
}

function finalHtmlTidy(obj) {
  const clean = s => String(s || "")
    .replace(/<p>\s*<\/p>/g, "")           // remove empty paragraphs
    .replace(/\s+<\/li>/g, "</li>")        // trim LI tails
    .replace(/\s+<\/p>/g, "</p>");         // trim P tails
  return {
    ...obj,
    aboutcontent: clean(obj.aboutcontent),
    howtoredeemcontent: clean(obj.howtoredeemcontent),
    promodetailscontent: clean(obj.promodetailscontent),
    termscontent: clean(obj.termscontent),
    faqcontent: Array.isArray(obj.faqcontent)
      ? obj.faqcontent.map(f => ({ ...f, answerHtml: clean(f.answerHtml) }))
      : obj.faqcontent
  };
}

// --- Canonical policy bullets (neutral, action-verb phrasing) ----------------
const PROMO_POLICY_BULLETS = {
  product: "Identify whether this is a subscription or one-time purchase, and confirm the exact plan or SKU before you apply a code.",
  scope:   "Confirm code eligibility for the selected tier; if no reduction appears, switch plans or re-apply to ensure the promo covers this SKU.",
  stacking:"Expect one code per checkout on Whop; remove any prefilled coupon, then re-apply the best code before you confirm.",
  renewals:"Check whether the promo applies to the first billing cycle only or to ongoing renewals; review renewal cadence on the final screen.",
  vat:     "Review VAT/GST and currency next to Total at checkout; taxes are calculated by region and may adjust the final amount."
};

const TERMS_POLICY_BULLETS = {
  platform:  "Purchases are processed on Whop under the seller's policies; availability, inclusions, and pricing are controlled by the creator.",
  refunds:   "Submit refund or dispute requests through Whop's Resolution Center; outcomes follow the creator's stated policy and are not guaranteed.",
  billing:   "For subscriptions, manage cancellations from your Whop account before renewal to avoid the next charge; review renewal cadence at checkout.",
  stacking:  "Promotions may not stack with other coupons or sales; remove any prefilled coupon before applying a new code.",
  regional:  "Taxes and currency are determined by region; the final price at checkout reflects VAT/GST and any regional adjustments."
};

// Parse <li>...</li> items
function getLis(html) {
  return String(html || "").match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
}

// Loose keyword presence (kept deliberately simple/robust)
function hasPolicy(items, key) {
  const text = items.map(s => s.replace(/<[^>]+>/g, "")).join(" || ").toLowerCase();
  const checks = {
    product:  /subscription|one[-\s]?time|plan|tier|sku/,
    scope:    /eligible|eligibility|excluded|appl(y|ies)|tier|sku|plan/,
    stacking: /stack|one code|single code|remove coupon|prefill/,
    renewals: /renewal|first billing|ongoing|recurr(ing|ence)|cadence/,
    vat:      /vat|gst|tax|currency|total/,
    platform: /whop|platform|seller|creator/,
    refunds:  /refund|resolution|dispute|policy/,
    billing:  /cancel|cancellation|renewal|cadence|subscription/,
    regional: /vat|gst|currency|region|tax/
  };
  return (checks[key] || /./).test(text);
}

function ensurePromoPolicyBullets(html) {
  let items = getLis(html);
  const need = [];
  if (!hasPolicy(items, "product"))  need.push(PROMO_POLICY_BULLETS.product);
  if (!hasPolicy(items, "scope"))    need.push(PROMO_POLICY_BULLETS.scope);
  if (!hasPolicy(items, "stacking")) need.push(PROMO_POLICY_BULLETS.stacking);
  if (!hasPolicy(items, "renewals")) need.push(PROMO_POLICY_BULLETS.renewals);
  if (!hasPolicy(items, "vat"))      need.push(PROMO_POLICY_BULLETS.vat);

  for (const b of need) {
    if (items.length < 5) items.push(`<li>${b}</li>`);
    else items[items.length - 1] = `<li>${b}</li>`;
  }
  return setListItems(html, items);
}

function ensureTermsPolicyBullets(html) {
  let items = getLis(html);
  const need = [];
  if (!hasPolicy(items, "platform")) need.push(TERMS_POLICY_BULLETS.platform);
  if (!hasPolicy(items, "refunds"))  need.push(TERMS_POLICY_BULLETS.refunds);
  if (!hasPolicy(items, "billing"))  need.push(TERMS_POLICY_BULLETS.billing);
  if (!hasPolicy(items, "stacking")) need.push(TERMS_POLICY_BULLETS.stacking);
  if (!hasPolicy(items, "regional")) need.push(TERMS_POLICY_BULLETS.regional);

  for (const b of need) {
    if (items.length < 5) items.push(`<li>${b}</li>`);
    else items[items.length - 1] = `<li>${b}</li>`;
  }
  return setListItems(html, items);
}

// --- SEO keyword regex helpers (centralized to avoid drift) ---
function esc(s) {
  // Escape regex special characters
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameForSeo(name) {
  // Normalize brand names for SEO matching (remove ™, ®, normalize &)
  // Do NOT change display text - this is for regex matching only
  return name.replace(/[™®]/g, "").replace(/\s*&\s*/g, " & ").trim();
}

function aliasAmpersandAnd(nameRaw) {
  // Bidirectional & ⇄ and aliasing: works whether literal contains "&" or "and" or neither
  // Only transforms tokenized "and" (surrounded by whitespace) to avoid hitting names like "AndCo"
  const n = esc(nameRaw);
  // Case 1: literal contains "&" → allow "&" OR "and"
  const hasAmp = /\s*&\s*/.test(nameRaw);
  // Case 2: literal contains " and " → allow "and" OR "&"
  const hasAnd = /\sand\s/i.test(nameRaw);

  let nAliased = n;
  if (hasAmp) {
    nAliased = nAliased.replace(/\\s\*&\\s\*/g, "(?:\\\\s*&\\\\s*|\\\\s+and\\\\s+)");
  }
  if (hasAnd) {
    // Only replace the tokenized " and " (escaped here) with alternation
    nAliased = nAliased.replace(/\\sand\\s/gi, "(?:\\\\s+and\\\\s+|\\\\s*&\\\\s*)");
  }
  return nAliased;
}

function mkPrimaryPromoRegex(nameRaw) {
  // Build primary keyword regex: "Brand promo code(s)", handles hyphen/NBSP/tight spacing
  // Also handles & ⇄ and aliasing bidirectionally (e.g., "A&B" ⇄ "A and B")
  const nWithAliasing = aliasAmpersandAnd(nameRaw);
  return new RegExp(`\\b${nWithAliasing}\\s*[-\u00A0\\s]?\\s*promo\\s*codes?\\b`, "i");
}

function mkSecondaryRegexes(nameRaw) {
  // Build secondary keyword regexes (discount, save on, current offer, etc.)
  // Also handles & ⇄ and aliasing bidirectionally
  const nWithAliasing = aliasAmpersandAnd(nameRaw);
  return [
    new RegExp(`\\bsave\\s+on\\s+${nWithAliasing}\\b`, "i"),
    new RegExp(`\\b${nWithAliasing}\\s*[-\u00A0\\s]?\\s*discount\\b`, "i"),
    /\bcurrent\s+offer\b/i,
    /\bspecial\s+offer\b/i,
    /\bvoucher\s+codes?\b/i,
  ];
}

function firstParagraphText(html) {
  // Extract text from FIRST <p> tag only (for placement enforcement)
  const m = String(html || "").match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);

  if (m && m[1]) {
    const text = stripTags(m[1]);
    // If first <p> is non-empty, use it
    if (text.trim().length > 0) return text;
  }

  // Fallback: no <p> tags found or first <p> is empty
  // Derive first ~120 words from stripped text
  const allText = stripTags(html);
  const words = allText.split(/\s+/).filter(Boolean);
  return words.slice(0, 120).join(" ");
}

// --- Hub detection & drill-down helpers ---

function urlParts(u) {
  try {
    const x = new URL(u);
    const parts = x.pathname.split("/").filter(Boolean);
    return { origin: x.origin, parts, href: x.href, search: x.search };
  } catch { return null; }
}

// Heuristic hub test: short textual evidence + grid/collection cues
function isLikelyThinHub(html, evidenceChars) {
  const text = stripTags(html).toLowerCase();
  const hubCues = [
    /products?/i, /memberships?/i, /courses?/i, /bundles?/i, /view\s+all/i,
    /creator/i, /offers?/i, /plans?/i, /pricing/i, /what's\s+included/i
  ];
  const hasCue = hubCues.some(re => re.test(text));
  // Keep your base min of 800; "thin hub window" 400–800 prevents false positives
  return evidenceChars >= 400 && evidenceChars < 800 && hasCue;
}

// Detect substantive product page content (reviews, FAQs, curriculum, etc.)
function hasUsefulBlocks(html) {
  const t = html.toLowerCase();
  // lightweight signals that the page has substance beyond a hero + button
  return (
    /reviews?\s*<\/?/.test(t) ||     // Reviews section
    /faqs?\s*<\/?/.test(t) ||        // FAQs accordion
    /what(?:'|'|)s\s+included/.test(t) ||
    /curriculum|syllabus|modules?/.test(t) ||
    /about\s+the\s+creator/.test(t)
  );
}

// Extract candidate product links under same creator prefix
// Extract anchor text and nearest heading for each candidate under same creator
function extractProductCandidates(html, creatorPathPrefix) {
  const out = [];
  const hrefRe = /<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = hrefRe.exec(html))) {
    let href = m[1] || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.toLowerCase().startsWith("javascript:")) continue;

    // Normalize to pathname, constrain to whop.com and same creator prefix
    try {
      let p = href;
      if (p.startsWith("//")) p = "https:" + p;
      if (p.startsWith("http")) {
        const u = new URL(p);
        if (!u.hostname.endsWith("whop.com")) continue;
        p = u.pathname;
      }
      // Strip query string and fragment from all paths (absolute and relative)
      p = p.split(/[?#]/)[0];
      if (!p.startsWith("/")) continue; // external or weird
      if (!p.toLowerCase().startsWith(creatorPathPrefix.toLowerCase())) continue;

      // drop creator root only; require /creator/<something>/
      const segs = p.split("/").filter(Boolean);
      if (segs.length < 2) continue;

      const anchorHtml = m[2] || "";
      const anchor = stripTags(anchorHtml).trim();

      // Look for a nearby heading within a small window before the anchor
      const windowStart = Math.max(0, m.index - 400);
      const context = html.slice(windowStart, m.index);
      const headingMatch = context.match(/<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>\s*$/i);
      const heading = headingMatch ? stripTags(headingMatch[2]).trim() : "";

      // ensure trailing slash for consistency
      if (!p.endsWith("/")) p += "/";

      out.push({ path: p, anchor, heading });
    } catch {}
  }
  // de-dup by path, prefer candidate with more text
  const bestByPath = new Map();
  for (const c of out) {
    const prev = bestByPath.get(c.path);
    const score = (c.anchor?.length || 0) + (c.heading?.length || 0);
    const prevScore = prev ? (prev.anchor?.length || 0) + (prev.heading?.length || 0) : -1;
    if (!prev || score > prevScore) bestByPath.set(c.path, c);
  }
  return [...bestByPath.values()];
}

// Simple slug normaliser
function normSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// Build simple acronyms like "MF" from "Mondy Friend" or "MF Capital"
function acronym(str) {
  return (String(str || "").match(/\b[A-Za-z]/g) || []).join("").toLowerCase();
}

// Semantic score: segment match + title similarity + acronym + depth bias
function scoreCandidate(cand, targetSlug, dbName) {
  const t = normSlug(String(targetSlug || "").split("/").pop());
  const last = normSlug(cand.path.split("/").filter(Boolean).pop() || "");

  let score = 0;

  // 1) URL segment match
  if (last === t) score += 100;
  else if (last.includes(t) || t.includes(last)) score += 70;

  // 2) Title similarity (tokens of DB name vs anchor+heading)
  const nameTokens = new Set(tokens(dbName));
  const titleTokens = new Set(tokens(`${cand.anchor || ""} ${cand.heading || ""}`));
  const inter = [...nameTokens].filter(x => titleTokens.has(x)).length;
  const union = new Set([...nameTokens, ...titleTokens]).size || 1;
  score += Math.round((inter / union) * 30);

  // 3) Acronym match
  const aDb = acronym(dbName);
  const aLast = acronym(last.replace(/-/g, " "));
  if (aDb && aLast) {
    if (aDb === aLast) score += 25;
    else if (aLast.startsWith(aDb) || aDb.startsWith(aLast)) score += 10;
  }

  // 4) Path depth bias: /creator/product/ preferred
  const depth = cand.path.split("/").filter(Boolean).length;
  if (depth >= 2) score += 10;

  return score;
}

// Choose 1–3 best candidates to probe (threshold + closeness rule)
function chooseBestProductCandidates(candidates, targetSlug, dbName) {
  if (!candidates.length) return [];
  const scored = candidates
    .map(c => ({ c, score: scoreCandidate(c, targetSlug, dbName) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  if (scored[0] && scored[0].score >= 45) picked.push(scored[0].c);
  if (scored[1] && scored[0] && (scored[0].score - scored[1].score) <= 15 && scored[1].score >= 45) {
    picked.push(scored[1].c);
  }
  // Allow a 3rd probe if it's within 5 points of #2 (helps ties like "two products")
  if (scored[2] && picked.length === 2 && (scored[1].score - scored[2].score) <= 5 && scored[2].score >= 45) {
    picked.push(scored[2].c);
  }
  return picked;
}

// Minimal brand-token sanity check on fetched page
function brandTokenPresent(html, dbName) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const h = (html.match(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "";
  const hay = stripTags(`${title} ${h}`).toLowerCase();
  const toks = Array.from(new Set(tokens(dbName)));
  return toks.some(tk => tk.length >= 3 && hay.includes(tk));
}

// --- Originality & human-style helpers ---

// Tokenize text for n-gram analysis
function tokens(text) {
  return String(text || "").toLowerCase().replace(/<[^>]+>/g, " ").match(/[a-z0-9]+/g) || [];
}

// Generate n-grams (default trigrams)
function shingles(words, k = 3) {
  const s = new Set();
  for (let i = 0; i + k <= words.length; i++) {
    s.add(words.slice(i, i + k).join(" "));
  }
  return s;
}

// Jaccard similarity between two sets
function jaccard(a, b) {
  const intersection = new Set([...a].filter(x => b.has(x))).size;
  return intersection / Math.max(1, (a.size + b.size - intersection));
}

// Split text into sentences
function splitSentences(text) {
  return String(text || "").replace(/<[^>]+>/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
}

// Compute text statistics (sentence variation, readability)
function textStats(text) {
  const words = tokens(text).length;
  const sents = splitSentences(text);
  const sentLens = sents.map(s => tokens(s).length).filter(n => n > 0);
  const mean = sentLens.reduce((a, b) => a + b, 0) / Math.max(1, sentLens.length);
  const variance = sentLens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, sentLens.length);
  const stdev = Math.sqrt(variance);
  return { words, sentences: sents.length, meanSentLen: mean, stdevSentLen: stdev };
}

// Check if text passes human-style cadence band
function passesStyleBand(html, slug = null, logOnFail = false) {
  const { sentences, meanSentLen, stdevSentLen } = textStats(html);
  // Enforce: ≥3 sentences, mean 13–22 words, stdev ≥4 (mixed short/long)
  const passes = sentences >= 3 && meanSentLen >= 13 && meanSentLen <= 22 && stdevSentLen >= 4;

  // Optional logging for debugging
  if (!passes && logOnFail && slug) {
    console.log(`cadence_check: field=aboutcontent sentences=${sentences} mean=${meanSentLen.toFixed(1)} stdev=${stdevSentLen.toFixed(1)} slug=${slug} (target: ≥3 sentences, mean 13-22, stdev ≥4)`);

    // Log to CSV for review
    writeCsvRow(CADENCE_CSV,
      ["slug", "field", "sentences", "mean", "stdev", "target"],
      [slug, "aboutcontent", String(sentences), meanSentLen.toFixed(1), stdevSentLen.toFixed(1), "≥3 sentences, mean 13-22, stdev ≥4"]
    );
  }

  return passes;
}

// PRNG seeded by string (deterministic per slug)
function prngSeed(str) {
  let h = 2166136261 >>> 0;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => (h = (h ^ (h >>> 13)) >>> 0, (h * 2.3283064365386963e-10) % 1);
}

// CTA pool for varied endings
const CTA_POOL = [
  "Explore current options and see what fits.",
  "Compare what's included and decide at checkout.",
  "Check the latest availability before you buy.",
  "Start with the entry tier and upgrade if it clicks.",
  "Look for time-limited perks on the checkout page."
];

// Pick deterministic CTA based on slug
function pickDeterministic(arr, slug) {
  const rnd = prngSeed(slug)();
  return arr[Math.floor(rnd * arr.length)];
}

// FAQ opener diversity check
function faqDiversityOk(faqs) {
  if (!Array.isArray(faqs)) return true;
  const starts = faqs.map(f => String(f?.question || "").trim().toLowerCase().split(/\s+/)[0]);
  const counts = starts.reduce((m, w) => (m[w] = (m[w] || 0) + 1, m), {});
  // Require at least 3 distinct question openers when n≥4
  const distinct = Object.keys(counts).length;
  return faqs.length < 4 || distinct >= 3;
}

// Bullet parallelism check (imperative voice)
function bulletsImperative(html) {
  const lis = String(html || "").match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
  if (!lis.length) return true;
  // Expanded imperative verb list (ensureImperativeStart normalizes many cases already)
  const allowed = /^(apply|compare|confirm|enter|join|access|start|explore|review|select|check|paste|copy|verify|visit|open|follow|redeem|activate|save|choose|view|find|locate|add|remove|reapply|re-apply|refresh|clear|identify|expect|submit|manage)\b/i;
  return lis.every(li => {
    const text = stripTags(li).trim();
    if (!text) return false; // reject empty bullets
    const first = (text.match(/^[a-z]+/i) || [""])[0];
    return allowed.test(first);
  });
}

// Rolling window of recent fingerprints (for cross-doc originality)
// Load persisted fingerprints from previous runs (last 2000 lines)
const recentFingerprints = (() => {
  if (!fs.existsSync(FINGERPRINTS_FILE)) return [];
  try {
    const content = fs.readFileSync(FINGERPRINTS_FILE, "utf8");
    const allLines = content.split(/\r?\n/).filter(Boolean);

    // Rotate file if it exceeds 250k lines (keep repo tidy)
    if (allLines.length > 250000) {
      const keep = allLines.slice(-2000);
      fs.writeFileSync(FINGERPRINTS_FILE, keep.join("\n") + "\n");
      console.log(`Rotated fingerprints file: kept last 2k of ${allLines.length.toLocaleString()} lines`);
      return keep.map(line => {
        const obj = JSON.parse(line);
        return { ...obj, fpAbout: new Set(obj.fpAbout) };
      });
    }

    // Normal load: last 2k lines
    const lines = allLines.slice(-2000);
    return lines.map(line => {
      const obj = JSON.parse(line);
      // Reconstruct Set from array (persisted as array for JSON)
      return { ...obj, fpAbout: new Set(obj.fpAbout) };
    });
  } catch (e) {
    console.warn(`Warning: Could not load fingerprints from ${FINGERPRINTS_FILE}: ${e.message}`);
    return [];
  }
})()

// Check if content is too similar to recent outputs
function isTooSimilarToRecent(html, threshold = 0.40) {
  const w = tokens(html);
  const s = shingles(w, 3);
  for (let i = recentFingerprints.length - 1; i >= 0 && i >= recentFingerprints.length - 200; i--) {
    const sim = jaccard(s, recentFingerprints[i].fpAbout);
    if (sim >= threshold) return true;
  }
  return false;
}

// Record fingerprint for future checks (in-memory + persist to disk)
function recordFingerprint(slug, aboutHtml) {
  const w = tokens(aboutHtml);
  const fpAbout = shingles(w, 3);
  const ts = Date.now();
  recentFingerprints.push({ slug, fpAbout, ts });
  if (recentFingerprints.length > 1000) recentFingerprints.shift();

  // Persist to disk (convert Set to Array for JSON serialization)
  try {
    const persistObj = { slug, fpAbout: Array.from(fpAbout), ts };
    fs.appendFileSync(FINGERPRINTS_FILE, JSON.stringify(persistObj) + "\n");
  } catch (e) {
    // Non-fatal: in-memory guard still works
    console.warn(`Warning: Could not persist fingerprint: ${e.message}`);
  }
}

// Check if aboutcontent has a CTA-style closing
function hasCTAClosing(html) {
  const text = String(html || "").toLowerCase();
  // Look for CTA-like patterns in the last paragraph/sentence
  const ctaPatterns = [
    /\bexplore\b.*\boptions?\b/,
    /\bcompare\b.*\bincluded?\b/,
    /\bcheck\b.*\bavailability\b/,
    /\bstart\b.*\b(tier|plan|option)\b/,
    /\blook\b.*\b(perk|offer|deal)s?\b/,
    /\b(see|view|browse)\b.*\b(what|option|deal)s?\b/,
    /\bdecide\b.*\bcheckout\b/,
    /\bupgrade\b.*\b(if|when)\b/
  ];
  return ctaPatterns.some(p => p.test(text));
}

function checkKeywordCaps(obj, name, preserved = {}) {
  const errs = [];
  if (!obj) return errs;

  // Normalize name for SEO matching (handles Brand™, Brand®, Brand & Co., etc.)
  const seoName = nameForSeo(name);

  // Build centralized regexes (prevents drift between checks)
  const primaryRe = mkPrimaryPromoRegex(seoName);
  const secondaryRes = mkSecondaryRegexes(seoName);

  const sections = [
    ["aboutcontent", !preserved?.about],
    ["promodetailscontent", !preserved?.details],
    ["howtoredeemcontent", !preserved?.redeem],
    ["termscontent", !preserved?.terms],
  ];

  for (const [field, check] of sections) {
    if (!check) continue;
    const text = stripTags(obj[field]);
    if (!text) continue;

    // primary ≤ 1
    const primaryHits = (text.match(primaryRe) || []).length;
    if (primaryHits > 1) errs.push(`${field}: primary keyword used ${primaryHits}× (max 1)`);

    // secondary combined ≤ 2
    let secondaryHits = 0;
    for (const re of secondaryRes) {
      secondaryHits += (text.match(re) || []).length;
    }
    if (secondaryHits > 2) errs.push(`${field}: secondary keywords used ${secondaryHits}× (max 2)`);
  }
  return errs;
}

function checkHardCounts(obj, preserved = {}) {
  const errs = [];
  const T = TARGETS;

  // Apply relaxed thresholds if RELAX_GUARDRAILS is enabled
  const relaxFactor = RELAX_GUARDRAILS ? 0.6 : 1.0;
  const relaxedT = {
    aboutParagraphsMin: Math.max(1, Math.floor(T.aboutParagraphsMin * relaxFactor)),
    aboutParagraphsMax: Math.ceil(T.aboutParagraphsMax * 1.2),
    aboutWordsMin: Math.max(60, Math.floor(T.aboutWordsMin * relaxFactor)),
    aboutWordsMax: Math.ceil(T.aboutWordsMax * 1.2),
    redeemStepsMin: Math.max(2, Math.floor(T.redeemStepsMin * relaxFactor)),
    redeemStepsMax: Math.ceil(T.redeemStepsMax * 1.2),
    redeemStepWordsMin: Math.max(8, Math.floor(T.redeemStepWordsMin * relaxFactor)),
    redeemStepWordsMax: Math.ceil(T.redeemStepWordsMax * 1.2),
    detailsBulletsMin: Math.max(2, Math.floor(T.detailsBulletsMin * relaxFactor)),
    detailsBulletsMax: Math.ceil(T.detailsBulletsMax * 1.2),
    detailsWordsMin: Math.max(60, Math.floor(T.detailsWordsMin * relaxFactor)),
    detailsWordsMax: Math.ceil(T.detailsWordsMax * 1.2),
    termsBulletsMin: Math.max(2, Math.floor(T.termsBulletsMin * relaxFactor)),
    termsBulletsMax: Math.ceil(T.termsBulletsMax * 1.2),
    termsWordsMin: Math.max(50, Math.floor(T.termsWordsMin * relaxFactor)),
    termsWordsMax: Math.ceil(T.termsWordsMax * 1.2),
    faqCountMin: Math.max(2, Math.floor(T.faqCountMin * relaxFactor)),
    faqCountMax: Math.ceil(T.faqCountMax * 1.2),
    faqAnswerWordsMin: Math.max(25, Math.floor(T.faqAnswerWordsMin * relaxFactor)),
    faqAnswerWordsMax: Math.ceil(T.faqAnswerWordsMax * 1.2),
  };
  const thresholds = RELAX_GUARDRAILS ? relaxedT : T;

  // helper
  const wc = (html) => countWords(html);
  const liCount = (html) => countTags(html || "", "li");
  const paraCount = (html) => countTags(html || "", "p");

  // ABOUT: paragraphs + words
  if (!preserved?.about && obj.aboutcontent) {
    const p = paraCount(obj.aboutcontent);
    if (p && (p < thresholds.aboutParagraphsMin || p > thresholds.aboutParagraphsMax)) {
      errs.push(`aboutcontent paragraphs ${p} not in ${thresholds.aboutParagraphsMin}–${thresholds.aboutParagraphsMax}`);
    }
    const w = wc(obj.aboutcontent);
    if (w && (w < thresholds.aboutWordsMin || w > thresholds.aboutWordsMax)) {
      errs.push(`aboutcontent words ${w} not in ${thresholds.aboutWordsMin}–${thresholds.aboutWordsMax}`);
    }
  }

  // REDEEM: steps 3–5, each step 10–20 words
  if (!preserved?.redeem && obj.howtoredeemcontent) {
    // ensure ordered list wrapper
    const hasOl = /<ol\b[^>]*>[\s\S]*<\/ol>/i.test(obj.howtoredeemcontent || "");
    if (!hasOl) errs.push(`howtoredeemcontent must use <ol> for steps`);

    const steps = liCount(obj.howtoredeemcontent);
    if (steps && (steps < thresholds.redeemStepsMin || steps > thresholds.redeemStepsMax)) {
      errs.push(`howtoredeem steps ${steps} not in ${thresholds.redeemStepsMin}–${thresholds.redeemStepsMax}`);
    }
    // per-step word counts
    const stepMatches = String(obj.howtoredeemcontent).match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
    stepMatches.forEach((li, i) => {
      const words = wc(li);
      if (words && (words < thresholds.redeemStepWordsMin || words > thresholds.redeemStepWordsMax)) {
        errs.push(`howtoredeem step ${i + 1} words ${words} not in ${thresholds.redeemStepWordsMin}–${thresholds.redeemStepWordsMax}`);
      }
    });
  }

  // DETAILS: bullets + words
  if (!preserved?.details && obj.promodetailscontent) {
    const b = liCount(obj.promodetailscontent);
    if (b && (b < thresholds.detailsBulletsMin || b > thresholds.detailsBulletsMax)) {
      errs.push(`promodetails bullets ${b} not in ${thresholds.detailsBulletsMin}–${thresholds.detailsBulletsMax}`);
    }
    const w = wc(obj.promodetailscontent);
    if (w && (w < thresholds.detailsWordsMin || w > thresholds.detailsWordsMax)) {
      errs.push(`promodetails words ${w} not in ${thresholds.detailsWordsMin}–${thresholds.detailsWordsMax}`);
    }
  }

  // TERMS: bullets + words
  if (!preserved?.terms && obj.termscontent) {
    const b = liCount(obj.termscontent);
    if (b && (b < thresholds.termsBulletsMin || b > thresholds.termsBulletsMax)) {
      errs.push(`terms bullets ${b} not in ${thresholds.termsBulletsMin}–${thresholds.termsBulletsMax}`);
    }
    const w = wc(obj.termscontent);
    if (w && (w < thresholds.termsWordsMin || w > thresholds.termsWordsMax)) {
      errs.push(`terms words ${w} not in ${thresholds.termsWordsMin}–${thresholds.termsWordsMax}`);
    }
  }

  // FAQ: 3–6 items, each answer 40–70 words
  if (!preserved?.faq && Array.isArray(obj.faqcontent)) {
    const n = obj.faqcontent.length;
    if (n && (n < thresholds.faqCountMin || n > thresholds.faqCountMax)) {
      errs.push(`faq count ${n} not in ${thresholds.faqCountMin}–${thresholds.faqCountMax}`);
    }
    for (let i = 0; i < obj.faqcontent.length; i++) {
      const ans = obj.faqcontent[i]?.answerHtml || "";
      const w = wc(ans);
      if (w && (w < thresholds.faqAnswerWordsMin || w > thresholds.faqAnswerWordsMax)) {
        errs.push(`faq answer ${i + 1} words ${w} not in ${thresholds.faqAnswerWordsMin}–${thresholds.faqAnswerWordsMax}`);
        break; // one is enough to trigger repair
      }
    }

    // Duplicate FAQ question guard
    const qs = obj.faqcontent.map(f => (f?.question || "").trim().toLowerCase()).filter(Boolean);
    const set = new Set(qs);
    if (qs.length !== set.size) errs.push("faqcontent contains duplicate questions");
  }

  // Anti-spam: ban links (scan all fields, not just first)
  const banLinks = /<a\b/i.test(
    [obj.aboutcontent, obj.promodetailscontent, obj.howtoredeemcontent, obj.termscontent]
      .filter(Boolean).join(" ")
  );
  if (banLinks) errs.push("No external links allowed (<a> tags found)");

  // Anti-spam: limit <strong> tags (avoid over-bolding)
  const strongCount = (html) => (String(html || "").match(/<strong\b/gi) || []).length;
  const tooBoldy =
    strongCount(obj.aboutcontent) > 3 ||
    strongCount(obj.promodetailscontent) > 3;
  if (tooBoldy) errs.push("Too many <strong> tags; keep emphasis minimal");

  // Brand-safety: forbid over-certain claims
  const bannedClaims = /\b(guaranteed|always|never|best price|lowest price)\b/i;
  const allText = [obj.aboutcontent, obj.promodetailscontent, obj.termscontent].join(" ");
  if (bannedClaims.test(allText)) errs.push("Over-certain claim language detected (avoid guarantees)");

  // Anti-spam: no synonym chains (e.g., "promo code coupon discount voucher")
  const synonymChain = /\b(promo\s*codes?|coupon|discount|voucher\s*codes?)\b(?:\s*[,/]\s*|\s+){2,}/i;
  if (synonymChain.test(stripTags(obj.aboutcontent))) {
    errs.push("Avoid chaining multiple synonyms back-to-back in aboutcontent");
  }

  // FAQ opener diversity (≥3 distinct openers when n≥4)
  if (!faqDiversityOk(obj.faqcontent)) {
    errs.push("faqcontent lacks opener diversity (vary How/What/Can/Where)");
  }

  // Bullet parallelism: imperative voice (action verbs)
  if (!preserved?.redeem && !bulletsImperative(obj.howtoredeemcontent)) {
    errs.push("howtoredeemcontent bullets should start with an action verb (imperative)");
  }
  if (!preserved?.details && !bulletsImperative(obj.promodetailscontent)) {
    errs.push("promodetailscontent bullets should start with an action verb (imperative)");
  }

  // Redeem list semantics: no nested <p> inside <ol>
  if (!preserved?.redeem && obj.howtoredeemcontent) {
    if (/<ol\b[^>]*>\s*<p>/i.test(obj.howtoredeemcontent)) {
      errs.push("howtoredeemcontent must contain <li> items inside <ol>, not <p>");
    }
  }

  return errs;
}

// Grounding verifier: simple lexical inclusion check
function checkGrounding(obj, evidence, preserved = {}) {
  if (!evidence || !evidence.textSample) return null; // no evidence, skip check

  const hay = (evidence.textSample || "").toLowerCase();
  const groundFails = [];

  // SEO boilerplate whitelist (allowed even if not in evidence, includes UK synonyms)
  const BOILERPLATE = new Set(["promo code","discount","offer","save","coupon","voucher","promo","special offer"]);
  const okBoilerplate = (s) => {
    const t = String(s).toLowerCase();
    for (const term of BOILERPLATE) if (t.includes(term)) return true;
    return false;
  };

  // Check if source is on whop.com (allow Whop mentions only if true)
  let isWhopHost = false;
  try {
    if (evidence?.finalUrl) {
      isWhopHost = new URL(evidence.finalUrl).hostname.endsWith("whop.com");
    }
  } catch (_) { isWhopHost = false; }

  // Helper: check if string is grounded in evidence
  function grounded(str) {
    if (!str) return true;
    if (str.length < 40) return true; // too short to score reliably
    if (/confirm at checkout/i.test(str)) return true; // allowed guardrail phrase
    if (okBoilerplate(str)) return true; // SEO boilerplate is safe
    if (isWhopHost && /\bwhop(\.com)?\b/i.test(str)) return true; // Allow Whop mention if host is whop.com
    // Tokenized keyphrase check (very lightweight)
    const needles = String(str).toLowerCase().split(/\b/).filter(w => w.length >= 5).slice(0, 6);
    const hits = needles.filter(n => hay.includes(n)).length;
    return hits >= Math.max(1, Math.ceil(needles.length * 0.3)); // require ~30% token hits
  }

  // Check non-preserved fields
  const blocks = [
    ["promodetailscontent", obj.promodetailscontent, preserved?.details],
    ["howtoredeemcontent", obj.howtoredeemcontent, preserved?.redeem],
    ["termscontent", obj.termscontent, preserved?.terms],
  ];
  for (const [key, s, isPreserved] of blocks) {
    if (isPreserved) continue; // skip preserved fields
    if (s && !grounded(s)) {
      groundFails.push(`non-evidenced text block detected in ${key}`);
      break;
    }
  }

  // Check FAQ answers (skip if entire FAQ was preserved OR if using generic fallback)
  const isGenericFaq = obj.__meta?.evidence_status === "general" || obj.__meta?.needsVerification === true;
  if (!preserved?.faq && !isGenericFaq && Array.isArray(obj.faqcontent)) {
    for (const qa of obj.faqcontent) {
      if (qa?.answerHtml && !grounded(qa.answerHtml)) {
        groundFails.push("faq answer not grounded");
        break;
      }
    }
  }

  return groundFails.length > 0 ? `Grounding check failed: ${groundFails[0]}` : null;
}

// Filter out style/cadence errors in must-succeed mode (keep only terminal errors)
function filterStyleErrors(errors) {
  const stylePatterns = [
    /bullets should start with an action verb/i,
    /Avoid chaining multiple synonyms/i,
    /Over-certain claim language/i,
    /lacks opener diversity/i,
    /must use <ol> for steps/i  // Already being soft-tolerated above, but good to filter here too
  ];

  return errors.filter(err => {
    // Keep all non-style errors (count violations, missing fields, etc.)
    return !stylePatterns.some(pattern => pattern.test(err));
  });
}

async function repairToConstraints(task, obj, fails) {
  // Use stronger model for repairs if available
  const prevModel = process.env.MODEL;
  if (STRONG_MODEL) process.env.MODEL = STRONG_MODEL;

  try {
    return await _repairToConstraintsImpl(task, obj, fails);
  } finally {
    // Restore original model
    process.env.MODEL = prevModel;
  }
}

async function _repairToConstraintsImpl(task, obj, fails) {
  // Handle step-level underruns like: "howtoredeem step 2 words 9 not in 10–20"
  const stepFail = fails.find(f =>
    /howtoredeem\s+step\s+(\d+)\s+words\s+(\d+)\s+not\s+in\s+(\d+)\s*[–—-]\s*(\d+)/i.test(f)
  );

  if (stepFail) {
    const m = stepFail.match(/howtoredeem\s+step\s+(\d+)\s+words\s+(\d+)\s+not\s+in\s+(\d+)\s*[–—-]\s*(\d+)/i);
    if (m) {
      const stepIndex = parseInt(m[1], 10);  // 1-based
      const current = parseInt(m[2], 10);
      const min = parseInt(m[3], 10);

      let html = String(obj.howtoredeemcontent || "");
      const items = splitListItems(html);
      if (items.length && stepIndex >= 1 && stepIndex <= items.length) {
        let li = items[stepIndex - 1];
        let words = current;

        let i = 0;
        // append short, relevant phrases until we meet min (with a tiny buffer)
        while (words < Math.max(min, STEP_WORD_MIN)) {
          li = appendPhraseToLi(li, pickAppendPhrase(i));
          i += 1;
          words = innerTextFromLi(li).split(/\s+/).filter(Boolean).length;
          if (i > 6) break; // hard stop safety
        }

        const before = current;
        html = replaceListItem(html, stepIndex, li);
        obj.howtoredeemcontent = html;

        // Apply sanitizers before final validation
        obj = sanitizePrimaryKeywordOutsideAbout(obj, task.slug);
        obj.howtoredeemcontent = enforceImperativeBullets(obj.howtoredeemcontent);
        obj.howtoredeemcontent = mapListItems(obj.howtoredeemcontent, normalizeImperativeLi);
        obj.howtoredeemcontent = mapListItems(obj.howtoredeemcontent, ensureBulletStartsImperative);
        obj.promodetailscontent = enforceImperativeBullets(obj.promodetailscontent);
        obj.aboutcontent = enforceHumanCadence(obj.aboutcontent, task.slug);
        // Apply cadence to FAQ answers
        if (Array.isArray(obj.faqcontent)) {
          obj.faqcontent = obj.faqcontent.map(f => ({
            ...f,
            answerHtml: enforceHumanCadence(f.answerHtml, task.slug)
          }));
        }

        // Apply deterministic padders
        // aboutcontent: enforceParagraphs → dedupeAdjacentSynonyms → tidyParagraphs → varySentenceCadence
        obj.aboutcontent = enforceParagraphs(obj.aboutcontent, { min: 2, max: 3, splitAtWords: 70 });
        obj.aboutcontent = dedupeAdjacentSynonyms(obj.aboutcontent);
        obj.aboutcontent = tidyParagraphs(obj.aboutcontent);
        obj.aboutcontent = varySentenceCadence(obj.aboutcontent);

        // promodetails: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensurePromoPolicyBullets → enforceBulletRange
        obj.promodetailscontent = padListToWordCount(obj.promodetailscontent, { minWords: 100, maxWords: 150, padPool: PAD_BULLETS_PROMO, minItems: 3, maxItems: 5 });
        obj.promodetailscontent = mapListItems(obj.promodetailscontent, normalizeImperativeLi);
        obj.promodetailscontent = mapListItems(obj.promodetailscontent, ensureImperativeStart);
        obj.promodetailscontent = keepFirstUl(obj.promodetailscontent);
        obj.promodetailscontent = ensurePromoPolicyBullets(obj.promodetailscontent);
        obj.promodetailscontent = padUlToWordCount(obj.promodetailscontent, 100, PAD_PROMO);
        obj.promodetailscontent = enforceBulletRange(obj.promodetailscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_PROMO });

        // terms: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensureTermsPolicyBullets → padUlToWordCount → enforceBulletRange
        obj.termscontent = padListToWordCount(obj.termscontent, { minWords: 80, maxWords: 120, padPool: PAD_BULLETS_TERMS, minItems: 3, maxItems: 5 });
        obj.termscontent = mapListItems(obj.termscontent, normalizeImperativeLi);
        obj.termscontent = mapListItems(obj.termscontent, ensureImperativeStart);
        obj.termscontent = keepFirstUl(obj.termscontent);
        obj.termscontent = ensureTermsPolicyBullets(obj.termscontent);
        obj.termscontent = padUlToWordCount(obj.termscontent, 80, PAD_TERMS);
        obj.termscontent = enforceBulletRange(obj.termscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_TERMS });

        // faq: padFaqAnswer (already calls tidyParagraphs internally)
        if (Array.isArray(obj.faqcontent)) {
          obj.faqcontent = obj.faqcontent.map(f => ({
            ...f,
            answerHtml: padFaqAnswer(f.answerHtml, { minWords: 40, maxWords: 70 })
          }));
        }

        // Final HTML tidy before sanitize
        obj = finalHtmlTidy(obj);

        obj = sanitizePayload(obj);
        obj.slug = task.slug;

        const after = innerTextFromLi(li).split(/\s+/).filter(Boolean).length;
        console.log(`repair_append_step: field=howtoredeem step=${stepIndex} ${before}→${after} (min=${min}) slug=${task.slug}`);

        return obj; // handled this repair; caller will re-validate
      }
    }
  }

  // Check if this is a word-count underrun that needs append-only repair
  const wordCountFail = fails.find(f => f.includes("words") && f.includes("not in"));

  if (wordCountFail) {
    // Extract field name and current count from error message
    // Format: "aboutcontent words 94 not in 120–180" (robust against hyphen variants)
    const match = wordCountFail.match(
      /^(\w+)\s+words\s+(\d+)\s+not\s+in\s+(\d+)\s*[–—-]\s*(\d+)$/i
    );
    if (match) {
      const [, fieldName, currentStr, minStr] = match;
      const current = parseInt(currentStr);
      const min = parseInt(minStr);

      if (current < min) {
        // Append-only repair for under-minimum
        const missing = min - current;
        const buffer = 10; // Add buffer to avoid boundary issues
        const targetWords = missing + buffer;

        // Log before count for observability
        const before = countWords(obj[fieldName]);

        const appendPrompt = `
You previously wrote the field "${fieldName}" for slug "${task.slug}".
It is ${current} words; the hard minimum is ${min}.

TASK: Append approximately ${targetWords} more words to the end, keeping tone/style consistent with existing content.
Do NOT rewrite or shorten existing text. Only add to the end to reach the minimum.
Use information from EVIDENCE only. If uncertain, add general helpful context about promo codes or the product category.
Return ONLY a JSON object with the single key "${fieldName}" containing the COMPLETE updated HTML string (original + appended).

Current ${fieldName}:
${obj[fieldName]}
`;
        const raw = await api.callLLM(appendPrompt);
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        const jsonStr = (firstBrace >= 0 && lastBrace > firstBrace) ? raw.slice(firstBrace, lastBrace+1) : raw;
        const updated = JSON.parse(jsonStr);

        // Guard against malformed repair JSON (handle nested or alternate keys)
        const candidate =
          updated[fieldName] ??
          updated?.data?.[fieldName] ??
          updated?.result?.[fieldName];

        if (typeof candidate === "string" && candidate.length > 0) {
          obj[fieldName] = candidate;
        } else {
          // Ultra-safe fallback: append raw text wrapped in a <p>
          const extra = (updated.text || updated.content || "").trim();
          if (extra) {
            obj[fieldName] = obj[fieldName].replace(/<\/p>\s*$/, '') + ' ' + extra + '</p>';
          } else {
            // If no usable content, throw to trigger fallback repair
            throw new Error(`Repair returned unusable format for ${fieldName}`);
          }
        }

        // Apply sanitizers before final validation
        obj = sanitizePrimaryKeywordOutsideAbout(obj, task.slug);
        obj.howtoredeemcontent = enforceImperativeBullets(obj.howtoredeemcontent);
        obj.howtoredeemcontent = mapListItems(obj.howtoredeemcontent, normalizeImperativeLi);
        obj.howtoredeemcontent = mapListItems(obj.howtoredeemcontent, ensureBulletStartsImperative);
        obj.promodetailscontent = enforceImperativeBullets(obj.promodetailscontent);
        obj.aboutcontent = enforceHumanCadence(obj.aboutcontent, task.slug);
        // Apply cadence to FAQ answers
        if (Array.isArray(obj.faqcontent)) {
          obj.faqcontent = obj.faqcontent.map(f => ({
            ...f,
            answerHtml: enforceHumanCadence(f.answerHtml, task.slug)
          }));
        }

        // Apply deterministic padders
        // aboutcontent: enforceParagraphs → dedupeAdjacentSynonyms → tidyParagraphs → varySentenceCadence
        obj.aboutcontent = enforceParagraphs(obj.aboutcontent, { min: 2, max: 3, splitAtWords: 70 });
        obj.aboutcontent = dedupeAdjacentSynonyms(obj.aboutcontent);
        obj.aboutcontent = tidyParagraphs(obj.aboutcontent);
        obj.aboutcontent = varySentenceCadence(obj.aboutcontent);

        // promodetails: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensurePromoPolicyBullets → enforceBulletRange
        obj.promodetailscontent = padListToWordCount(obj.promodetailscontent, { minWords: 100, maxWords: 150, padPool: PAD_BULLETS_PROMO, minItems: 3, maxItems: 5 });
        obj.promodetailscontent = mapListItems(obj.promodetailscontent, normalizeImperativeLi);
        obj.promodetailscontent = mapListItems(obj.promodetailscontent, ensureImperativeStart);
        obj.promodetailscontent = keepFirstUl(obj.promodetailscontent);
        obj.promodetailscontent = ensurePromoPolicyBullets(obj.promodetailscontent);
        obj.promodetailscontent = padUlToWordCount(obj.promodetailscontent, 100, PAD_PROMO);
        obj.promodetailscontent = enforceBulletRange(obj.promodetailscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_PROMO });

        // terms: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensureTermsPolicyBullets → padUlToWordCount → enforceBulletRange
        obj.termscontent = padListToWordCount(obj.termscontent, { minWords: 80, maxWords: 120, padPool: PAD_BULLETS_TERMS, minItems: 3, maxItems: 5 });
        obj.termscontent = mapListItems(obj.termscontent, normalizeImperativeLi);
        obj.termscontent = mapListItems(obj.termscontent, ensureImperativeStart);
        obj.termscontent = keepFirstUl(obj.termscontent);
        obj.termscontent = ensureTermsPolicyBullets(obj.termscontent);
        obj.termscontent = padUlToWordCount(obj.termscontent, 80, PAD_TERMS);
        obj.termscontent = enforceBulletRange(obj.termscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_TERMS });

        // faq: padFaqAnswer (already calls tidyParagraphs internally)
        if (Array.isArray(obj.faqcontent)) {
          obj.faqcontent = obj.faqcontent.map(f => ({
            ...f,
            answerHtml: padFaqAnswer(f.answerHtml, { minWords: 40, maxWords: 70 })
          }));
        }

        // Final HTML tidy before sanitize
        obj = finalHtmlTidy(obj);

        obj = sanitizePayload(obj);
        obj.slug = task.slug;

        // Log after count for observability
        const after = countWords(obj[fieldName]);
        console.log(`repair_append: field=${fieldName} ${before}→${after} (min=${min}) slug=${task.slug}`);

        return obj;
      }
    }
  }

  // Fall back to generic repair for other issues
  const fixPrompt = `
You are fixing a JSON object that must conform exactly to constraints.
IMPORTANT: Only use information present in EVIDENCE (same as before). If uncertain, omit or say "confirm at checkout".
Only adjust counts and structure; do not invent specific prices or guarantees.
Maintain allowed tags: <p>, <ul>, <ol>, <li>, <strong>, <em>. Keep answers neutral and accurate.
Return JSON only (no markdown), with the same keys.

Whop slug: ${task.slug}
Display name: ${task.name}

Current JSON:
${JSON.stringify(obj)}

Issues:
- ${fails.join("\n- ")}
`;
  const raw = await api.callLLM(fixPrompt);
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const jsonStr = (firstBrace >= 0 && lastBrace > firstBrace) ? raw.slice(firstBrace, lastBrace+1) : raw;
  let fixed = JSON.parse(jsonStr);

  // Apply sanitizers before final validation
  fixed = sanitizePrimaryKeywordOutsideAbout(fixed, task.slug);
  fixed.howtoredeemcontent = enforceImperativeBullets(fixed.howtoredeemcontent);
  fixed.howtoredeemcontent = mapListItems(fixed.howtoredeemcontent, normalizeImperativeLi);
  fixed.howtoredeemcontent = mapListItems(fixed.howtoredeemcontent, ensureBulletStartsImperative);
  fixed.promodetailscontent = enforceImperativeBullets(fixed.promodetailscontent);
  fixed.aboutcontent = enforceHumanCadence(fixed.aboutcontent, task.slug);
  // Apply cadence to FAQ answers
  if (Array.isArray(fixed.faqcontent)) {
    fixed.faqcontent = fixed.faqcontent.map(f => ({
      ...f,
      answerHtml: enforceHumanCadence(f.answerHtml, task.slug)
    }));
  }

  // Apply deterministic padders
  // aboutcontent: enforceParagraphs → dedupeAdjacentSynonyms → tidyParagraphs
  fixed.aboutcontent = enforceParagraphs(fixed.aboutcontent, { min: 2, max: 3, splitAtWords: 70 });
  fixed.aboutcontent = dedupeAdjacentSynonyms(fixed.aboutcontent);
  fixed.aboutcontent = tidyParagraphs(fixed.aboutcontent);

  // promodetails: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensurePromoPolicyBullets → enforceBulletRange
  fixed.promodetailscontent = padListToWordCount(fixed.promodetailscontent, { minWords: 100, maxWords: 150, padPool: PAD_BULLETS_PROMO, minItems: 3, maxItems: 5 });
  fixed.promodetailscontent = mapListItems(fixed.promodetailscontent, normalizeImperativeLi);
  fixed.promodetailscontent = mapListItems(fixed.promodetailscontent, ensureImperativeStart);
  fixed.promodetailscontent = keepFirstUl(fixed.promodetailscontent);
  fixed.promodetailscontent = ensurePromoPolicyBullets(fixed.promodetailscontent);
  fixed.promodetailscontent = padUlToWordCount(fixed.promodetailscontent, 100, PAD_PROMO);
  fixed.promodetailscontent = enforceBulletRange(fixed.promodetailscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_PROMO });

  // terms: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensureTermsPolicyBullets → padUlToWordCount → enforceBulletRange
  fixed.termscontent = padListToWordCount(fixed.termscontent, { minWords: 80, maxWords: 120, padPool: PAD_BULLETS_TERMS, minItems: 3, maxItems: 5 });
  fixed.termscontent = mapListItems(fixed.termscontent, normalizeImperativeLi);
  fixed.termscontent = mapListItems(fixed.termscontent, ensureImperativeStart);
  fixed.termscontent = keepFirstUl(fixed.termscontent);
  fixed.termscontent = ensureTermsPolicyBullets(fixed.termscontent);
  fixed.termscontent = padUlToWordCount(fixed.termscontent, 80, PAD_TERMS);
  fixed.termscontent = enforceBulletRange(fixed.termscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_TERMS });

  // faq: padFaqAnswer (already calls tidyParagraphs internally)
  if (Array.isArray(fixed.faqcontent)) {
    fixed.faqcontent = fixed.faqcontent.map(f => ({
      ...f,
      answerHtml: padFaqAnswer(f.answerHtml, { minWords: 40, maxWords: 70 })
    }));
  }

  // Final HTML tidy before sanitize
  fixed = finalHtmlTidy(fixed);

  // Self-healing normalisation for evidence repair (same as generation layer)
  const urlHost = new URL(task.url).hostname;
  const isKnownSPA = /(^|\.)whop\.com$/i.test(urlHost);
  fixed = normaliseOutput(fixed, { isKnownSPA, __safeName: task.displayName || task.name });

  fixed = sanitizePayload(fixed);
  let allErrors = checkHardCounts(fixed);

  // Filter style errors in must-succeed mode
  if (ACTIVE_POLICY.retryUntilSuccess && allErrors.length > 0) {
    const terminal = filterStyleErrors(allErrors);
    if (terminal.length < allErrors.length) {
      console.log(`⚠️  Filtered ${allErrors.length - terminal.length} style/cadence errors in must-succeed mode`);
    }
    allErrors = terminal;
  }

  const err = validatePayload(fixed) || allErrors[0] || null;
  if (err) {
    // Must-succeed soft-accept: allow repair failures with warning
    if (ACTIVE_POLICY.retryUntilSuccess) {
      console.log(`⚠️  Must-succeed: accepting repair with validation warnings`);
      fixed.__meta = {
        ...(fixed.__meta || {}),
        confidence: fixed.__meta?.confidence || "medium",
        evidence_status: fixed.__meta?.evidence_status || "general",
        indexable: true,
        soft_accept: true,
        validation_warnings: [
          ...(fixed.__meta?.validation_warnings || []),
          `Repair validation: ${err}`
        ]
      };
      fixed.slug = task.slug;
      return fixed;
    }
    throw new Error(`Repair failed: ${err}`);
  }
  fixed.slug = task.slug;
  return fixed;
}

// --- Similarity detection (simhash-lite) ---
function normalizeText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")   // strip tags
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function simhash(str) {
  // very small, rough simhash using SHA-256 bit weighting
  const h = crypto.createHash("sha256").update(str).digest();
  const bits = new Array(256).fill(0);
  const tokens = str.split(/\s+/);
  for (const t of tokens) {
    const th = crypto.createHash("md5").update(t).digest(); // 128-bit
    for (let i=0;i<128;i++){
      const bit = (th[Math.floor(i/8)] >> (7-(i%8))) & 1;
      bits[i] += bit ? 1 : -1;
    }
  }
  // produce 128-bit hash
  const out = Buffer.alloc(16);
  for (let i=0;i<128;i++){
    const byte = Math.floor(i/8);
    out[byte] = (out[byte] << 1) | (bits[i] >= 0 ? 1 : 0);
  }
  return out.toString("hex");
}

function hashOf(obj) {
  const text = normalizeText(obj.aboutcontent) + " " + normalizeText(obj.promodetailscontent);
  return simhash(text);
}

function similarity(hexA, hexB) {
  // hamming similarity on hex strings
  const a = Buffer.from(hexA, "hex");
  const b = Buffer.from(hexB, "hex");
  let same = 0, total = a.length*8;
  for (let i=0;i<a.length;i++){
    let x = a[i] ^ b[i];
    for (let j=0;j<8;j++){ if (((x>>j)&1) === 0) same++; }
  }
  return same/total;
}

function recordHash(h) {
  simState.recent.push(h);
  if (simState.recent.length > SIM_MAX) simState.recent.shift();
  fs.writeFileSync(SIM_TRACK_FILE, JSON.stringify(simState, null, 2));
}

async function worker(task) {
  const { slug, name, url } = task;

  // Check retry ceiling (IGNORE_CHECKPOINT mode only)
  // Track retry attempts (but don't bail early - we need evidence first)
  let attempts = 1;
  if (IGNORE_CHECKPOINT) {
    attempts = bumpRetry(slug);
    if (attempts > 1) {
      console.log(`🔄 Retry attempt ${attempts}/${EFFECTIVE_MAX_RETRIES} for ${slug}`);
    }
  }

  // Validate URL exists
  if (!url || !/^https?:\/\//i.test(url)) {
    fs.appendFileSync(REJECTS_FILE, JSON.stringify({ slug, error: "Missing or invalid URL" }) + "\n");
    rejectAndPersist(slug, "Missing or invalid URL");
    return;
  }

  // Fetch evidence from URL
  let evidence;
  try {
    const forceRecrawl = FORCE_RECRAWL || task.forceRecrawl;
    evidence = await obtainEvidence(url, slug, name, forceRecrawl);
  } catch (e) {
    fs.appendFileSync(REJECTS_FILE, JSON.stringify({ slug, error: `Evidence fetch failed: ${e.message}` }) + "\n");
    rejectAndPersist(slug, `Evidence fetch failed: ${e.message}`);
    return;
  }

  // Skip gracefully if evidence fetch returned null (404, insufficient evidence, etc.)
  if (!evidence) {
    fs.appendFileSync(REJECTS_FILE, JSON.stringify({ slug, error: "Soft skip: 404 or insufficient evidence" }) + "\n");
    rejectAndPersist(slug, "Soft skip: 404 or insufficient evidence");
    return; // Already logged warning in obtainEvidence
  }

  // MAX-RETRIES PATH: Try extractive-first, then synthetic fallback
  if (attempts > EFFECTIVE_MAX_RETRIES && ACTIVE_POLICY.retryUntilSuccess) {
    const evidenceText = evidence?.textSample || "";
    const evidenceHtml = evidence?.html || "";
    const quotes = evidence?.quotes || [];
    const lang = evidence?.lang || 'en';
    const features = evidence?.features || [];

    const hasEnoughEvidence = evidenceText.length >= 300 && quotes.length >= 2;

    if (hasEnoughEvidence) {
      // EXTRACTIVE PATH: zero-hallucination content from verbatim quotes
      console.log(`📝 Max-retries → extractive path for ${slug} (${lang}, ${quotes.length} quotes, ${features.length} features)`);

      const extractiveContent = buildExtractiveFromEvidence({
        slug,
        name: name || slug,
        host: new URL(evidence.finalUrl || url).hostname,
        evidence
      });

      const output = {
        slug,
        ...extractiveContent,
        __meta: {
          sourceUrl: url,
          finalUrl: evidence.finalUrl || url,
          evidenceHash: evidence.textHash || null,
          drilled: evidence.drilled || false,
          confidence: "medium",
          evidence_status: "extractive",
          indexable: true,
          lang,
          quote_count: quotes.length,
          feature_count: features.length,
          attempt_count: attempts
        }
      };

      // Write output (skip fingerprint/dedupe for extractive)
      fs.appendFileSync(OUT_FILE, JSON.stringify(output) + "\n");

      // Atomic append to master
      if (!EVIDENCE_ONLY) {
        try {
          appendLineAtomic("data/content/master/updates.jsonl", output);
          appendLineAtomic("data/content/master/successes.jsonl", output);
          removeRejectIfExists(slug);
        } catch (err) {
          console.error(`⚠️  Failed to append extractive success: ${err.message}`);
        }
      }

      // Mark done and clean up
      ck.done[slug] = true;
      delete ck.pending[slug];
      persistCheckpoint();
      return;
    }

    // SYNTHETIC FALLBACK: insufficient evidence for extractive
    if (ACTIVE_POLICY.allowSynthetic) {
      console.warn(`🔄 Max retries + insufficient evidence → synthetic for ${slug} (${evidenceText.length} chars, ${quotes.length} quotes)`);
      const safeName = (name || slug).replace(/[^\w\s-]/g, "");
      const synth = buildSyntheticFallback({ slug, displayName: safeName, name: safeName });

      const output = {
        ...synth,
        __meta: {
          sourceUrl: url,
          finalUrl: evidence?.finalUrl || url,
          evidenceHash: evidence?.textHash || null,
          drilled: evidence?.drilled || false,
          confidence: "low",
          evidence_status: "synthetic",
          indexable: false,
          attempt_count: attempts
        }
      };

      // Write output (skip fingerprint/dedupe for synthetic)
      fs.appendFileSync(OUT_FILE, JSON.stringify(output) + "\n");

      // Atomic append to master
      if (!EVIDENCE_ONLY) {
        try {
          appendLineAtomic("data/content/master/updates.jsonl", output);
          appendLineAtomic("data/content/master/successes.jsonl", output);
          removeRejectIfExists(slug);
        } catch (err) {
          console.error(`⚠️  Failed to append synthetic success: ${err.message}`);
        }
      }

      // Mark done and clean up
      ck.done[slug] = true;
      delete ck.pending[slug];
      persistCheckpoint();
      return;
    }

    // Legacy path: reject if synthetic not allowed
    rejectAndPersist(slug, `abandoned after ${attempts} attempts`, { errorCode: "ABANDONED" });
    return;
  }

  // Evidence-only mode: cheap probe without model spend
  if (EVIDENCE_ONLY) {
    const len = (evidence?.textSample || "").length;
    const ok = len >= EVIDENCE_MIN_CHARS;
    // Log minimal CSV row (slug, status, chars)
    try {
      const row = [slug, ok ? "READY" : "SKIP_NO_EVIDENCE", len].join(",");
      fs.appendFileSync("logs/retry-191-evidence.csv", row + "\n");
    } catch (csvErr) {
      console.error(`⚠️  Failed to log evidence CSV: ${csvErr.message}`);
    }
    if (!ok) {
      // Persist as reject with clear reason
      rejectAndPersist(slug, `evidence-only probe: insufficient content (${len} chars)`);
    } else {
      console.log(`✅ Evidence ready: ${slug} (${len} chars)`);
    }
    return; // Never call the model in evidence-only mode
  }

  // Dry-run mode: validate fetch/grounding at scale without spend
  if (DRY_RUN) {
    const dryOutput = {
      slug,
      __meta: {
        sourceUrl: url,
        finalUrl: evidence?.finalUrl || url,
        evidenceHash: evidence?.textHash || null,
        evidenceChars: evidence?.textSample?.length || 0,
        paras: evidence?.paras?.length || 0,
        bullets: evidence?.bullets?.length || 0,
        faq: evidence?.faq?.length || 0,
        drilled: evidence?.drilled || false,
        dryRun: true
      }
    };
    delete dryOutput.promodetails;

    // Fingerprint dedupe: avoid duplicate writes (even in dry run for consistency)
    const drysha = stableDigest(dryOutput);
    const dryprior = fingerprints.get(slug);

    // If digest unchanged, skip writing but mark done
    if (dryprior && dryprior === drysha) {
      ck.done[slug] = true;
      delete ck.pending[slug];
      persistCheckpoint();
      return;
    }

    // Write output and update fingerprint
    fs.appendFileSync(OUT_FILE, JSON.stringify(dryOutput) + "\n");
    appendFingerprint({ slug, sha: drysha });
    fingerprints.set(slug, drysha);

    if (evidence?.drilled) drilledCount++;
    ck.done[slug] = true;
    delete ck.pending[slug];
    persistCheckpoint();
    return;
  }

  // Pass existing content fields to prompt (for augment mode)
  const existing = {
    about: task.about,
    redeem: task.redeem,
    details: task.details,
    terms: task.terms,
    faq: task.faq
  };

  const prompt = makeUserPrompt({ slug, name, existing, evidence });
  ck.pending[slug] = Date.now();
  persistCheckpoint();

  // Simple exponential backoff with jitter
  for (let attempt=1; attempt<=4; attempt++) {
    try {
      const raw = await api.callLLM(prompt);
      // Some models return JSON text; ensure we parse the first object.
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      const jsonStr = (firstBrace >= 0 && lastBrace > firstBrace) ? raw.slice(firstBrace, lastBrace+1) : raw;
      let obj = JSON.parse(jsonStr);

      // JSON shape validation (belt-and-braces type checking)
      const shapeErrs = [];
      for (const k of ["aboutcontent","promodetailscontent","howtoredeemcontent","termscontent"]) {
        if (typeof obj[k] !== "string") shapeErrs.push(`${k} must be a string`);
      }
      if (!Array.isArray(obj.faqcontent)) shapeErrs.push("faqcontent must be an array");
      if (shapeErrs.length) throw new Error(`Schema validation failed: ${shapeErrs.join("; ")}`);

      // Sanitize model output first
      obj = sanitizePayload(obj);

      // --- AUGMENT MERGE: keep existing text, fill only missing ---
      const keep = (v) => Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim().length > 0);
      const preserved = {
        about: keep(task.about),
        redeem: keep(task.redeem),
        details: keep(task.details),
        terms: keep(task.terms),
        faq: !!(Array.isArray(task.faq) && task.faq.length)
      };

      obj.aboutcontent        = preserved.about   ? task.about   : obj.aboutcontent;
      obj.howtoredeemcontent  = preserved.redeem  ? task.redeem  : obj.howtoredeemcontent;
      obj.promodetailscontent = preserved.details ? task.details : obj.promodetailscontent;
      obj.termscontent        = preserved.terms   ? task.terms   : obj.termscontent;
      obj.faqcontent          = preserved.faq     ? task.faq     : obj.faqcontent;

      // Re-sanitize after merge so preserved fields are also cleaned
      obj = sanitizePayload(obj);

      // Apply content sanitizers before validation
      obj = sanitizePrimaryKeywordOutsideAbout(obj, task.slug);
      obj.howtoredeemcontent = enforceImperativeBullets(obj.howtoredeemcontent);
      obj.howtoredeemcontent = mapListItems(obj.howtoredeemcontent, normalizeImperativeLi);
      obj.howtoredeemcontent = mapListItems(obj.howtoredeemcontent, ensureBulletStartsImperative);
      obj.promodetailscontent = enforceImperativeBullets(obj.promodetailscontent);
      obj.aboutcontent = enforceHumanCadence(obj.aboutcontent, task.slug);
      // Apply cadence to FAQ answers
      if (Array.isArray(obj.faqcontent)) {
        obj.faqcontent = obj.faqcontent.map(f => ({
          ...f,
          answerHtml: enforceHumanCadence(f.answerHtml, task.slug)
        }));
      }

      // Apply deterministic padders to guarantee minimums (no LLM calls)
      // aboutcontent: enforceParagraphs → dedupeAdjacentSynonyms → tidyParagraphs → varySentenceCadence
      obj.aboutcontent = enforceParagraphs(obj.aboutcontent, { min: 2, max: 3, splitAtWords: 70 });
      obj.aboutcontent = dedupeAdjacentSynonyms(obj.aboutcontent);
      obj.aboutcontent = tidyParagraphs(obj.aboutcontent);
      obj.aboutcontent = varySentenceCadence(obj.aboutcontent);

      // promodetails: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensurePromoPolicyBullets → padUlToWordCount → enforceBulletRange
      obj.promodetailscontent = padListToWordCount(obj.promodetailscontent, { minWords: 100, maxWords: 150, padPool: PAD_BULLETS_PROMO, minItems: 3, maxItems: 5 });
      obj.promodetailscontent = mapListItems(obj.promodetailscontent, normalizeImperativeLi);
      obj.promodetailscontent = mapListItems(obj.promodetailscontent, ensureImperativeStart);
      obj.promodetailscontent = keepFirstUl(obj.promodetailscontent);
      obj.promodetailscontent = ensurePromoPolicyBullets(obj.promodetailscontent);
      obj.promodetailscontent = padUlToWordCount(obj.promodetailscontent, 100, PAD_PROMO);
      obj.promodetailscontent = enforceBulletRange(obj.promodetailscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_PROMO });

      // terms: pad → normalizeImperativeLi → ensureImperativeStart → keepFirstUl → ensureTermsPolicyBullets → padUlToWordCount → enforceBulletRange
      obj.termscontent = padListToWordCount(obj.termscontent, { minWords: 80, maxWords: 120, padPool: PAD_BULLETS_TERMS, minItems: 3, maxItems: 5 });
      obj.termscontent = mapListItems(obj.termscontent, normalizeImperativeLi);
      obj.termscontent = mapListItems(obj.termscontent, ensureImperativeStart);
      obj.termscontent = keepFirstUl(obj.termscontent);
      obj.termscontent = ensureTermsPolicyBullets(obj.termscontent);
      obj.termscontent = padUlToWordCount(obj.termscontent, 80, PAD_TERMS);
      obj.termscontent = enforceBulletRange(obj.termscontent, { minItems: 3, maxItems: 5, pool: PAD_BULLETS_TERMS });

      // faq: padFaqAnswer (already calls tidyParagraphs internally)
      if (Array.isArray(obj.faqcontent)) {
        obj.faqcontent = obj.faqcontent.map(f => ({
          ...f,
          answerHtml: padFaqAnswer(f.answerHtml, { minWords: 40, maxWords: 70 })
        }));
      }

      // Final "promo code" guardrail: ensure no leakage outside aboutcontent (post-merge assert)
      // This makes the rule impossible to fail by doing one final sweep
      obj = sanitizePrimaryKeywordOutsideAbout(obj, task.slug);

      // Final HTML tidy before validation
      obj = finalHtmlTidy(obj);

      // Self-healing normalisation (repair formatting before validation)
      const urlHost = new URL(evidence?.finalUrl || url).hostname;
      const isKnownSPA = /(^|\.)whop\.com$/i.test(urlHost);
      obj = normaliseOutput(obj, { isKnownSPA, __safeName: task.displayName || name });

      // ====================== FAQ PATH ======================
      try {
        const evidenceHost = urlHost;
        const evidenceHtml = evidence?.html || "";
        const evidenceText = (evidence?.textSample || "").replace(/\s+/g, " ").trim();

        // Decide whether to skip expensive FAQ retries and use generic bank directly
        const forceGenericFAQ =
          GENERIC_FAQ_SLUGS.has(slug) ||
          (FORCE_GENERIC_ON_PRIOR_FAQ_REJECT && priorFaqGroundingFailed(slug));

        if (forceGenericFAQ) {
          // Enrich evidence with extractive data (lang, quotes, features)
          const lang = detectLang(evidenceText || evidenceHtml);
          const quotes = makeQuoteBank(evidenceText || evidenceHtml);
          const features = extractFeaturePhrases(evidenceText || evidenceHtml);

          // Get visibleText for paraphraser (already computed in evidence)
          const visibleText = evidence?.visibleText || "";

          // Three-tier approach: paraphraser > extractive > generic
          // 1. Try paraphraser if we have clean visibleText (≥400 chars)
          if (visibleText.length >= 400) {
            console.log(`🤖 Paraphraser fast-path for ${slug} (${visibleText.length} chars visibleText)`);

            try {
              const paraphrasedContent = await buildParaphrasedFromEvidence({
                api,
                slug,
                name,
                host: evidenceHost,
                evidence: { ...evidence, lang, quotes, features },
                normaliseOutput
              });

              // Merge paraphrased content into obj
              obj = {
                ...obj,
                ...paraphrasedContent
              };

              obj.__meta = {
                ...(obj.__meta || {}),
                confidence: "high",
                evidence_status: "paraphrased",
                indexable: true,
                lang,
                visibleTextLength: visibleText.length
              };
            } catch (err) {
              console.error(`❌ Paraphraser failed for ${slug}: ${err.message}`);
              // Fall through to extractive/generic on paraphraser failure
            }
          }

          // 2. If paraphraser didn't run or failed, try extractive content
          if (!obj.__meta?.evidence_status || obj.__meta.evidence_status !== "paraphrased") {
            const hasEnoughEvidence =
              evidenceText.length >= 300 && quotes.length >= 2;

            if (hasEnoughEvidence) {
              console.log(`📝 Extractive fast-path for ${slug} (${lang}, ${quotes.length} quotes, ${features.length} features)`);

              // Build extractive content from evidence
              const enrichedEvidence = {
                ...evidence,
                lang,
                quotes,
                features
              };

              const extractiveContent = buildExtractiveFromEvidence({
                slug,
                name,
                host: evidenceHost,
                evidence: enrichedEvidence
              });

              // Merge extractive content into obj
              obj = {
                ...obj,
                ...extractiveContent
              };

              obj.__meta = {
                ...(obj.__meta || {}),
                confidence: "medium",
                evidence_status: "extractive",
                indexable: true,
                lang,
                quote_count: quotes.length,
                feature_count: features.length
              };
            } else {
              // 3. Fallback to generic FAQ if not enough evidence
              console.log(`🟨 Generic FAQ fast-path for ${slug} (insufficient evidence: ${evidenceText.length} chars, ${quotes.length} quotes)`);
              const display = (task?.displayName || name || slug || "").trim();
              obj.faqcontent = buildGeneralFaq(display, 5, slug);
              obj.__meta = {
                ...(obj.__meta || {}),
                confidence: obj.__meta?.confidence || "medium",
                evidence_status: "general",
                indexable: true,
                needsVerification: true
              };
            }
          }

          // Ensure formatting & counts
          obj = normaliseOutput(obj, { isKnownSPA, __safeName: task.displayName || name });
        } else {
          // Standard FAQ grounding loop with retries
          let faqTries = 0;
          const maxFaqTries = ACTIVE_POLICY.retryUntilSuccess ? 3 : 2;

          while (faqTries < maxFaqTries &&
                 !faqIsGrounded(obj.faqcontent, evidenceText, evidenceHost)) {
            faqTries++;
            console.log(`🔄 FAQ not grounded → regenerating (${faqTries}/${maxFaqTries}) for ${slug}`);

            // Create a wrapper function to call the model and parse JSON
            const callModelJSON = async (sys, user) => {
              const combined = `${sys}\n\n${user}`;
              const raw = await api.callLLM(combined);
              const firstBrace = raw.indexOf("[");
              const lastBrace = raw.lastIndexOf("]");
              if (firstBrace >= 0 && lastBrace > firstBrace) {
                return JSON.parse(raw.slice(firstBrace, lastBrace+1));
              }
              return JSON.parse(raw);
            };

            obj.faqcontent = await regenerateFaqGrounded(callModelJSON, evidenceHtml, evidenceHost);
            obj = normaliseOutput(obj, { isKnownSPA, __safeName: task.displayName || name });
          }

          if (!faqIsGrounded(obj.faqcontent, evidenceText, evidenceHost)) {
            // FAQ retries exhausted - try paraphraser before generic fallback
            const visibleText = evidence?.visibleText || "";
            const lang = detectLang(evidenceText || evidenceHtml);

            if (visibleText.length >= 400) {
              console.log(`🤖 Max-retries paraphraser fallback for ${slug} (${visibleText.length} chars visibleText)`);

              try {
                const paraphrasedContent = await buildParaphrasedFromEvidence({
                  api,
                  slug,
                  name,
                  host: evidenceHost,
                  evidence: { ...evidence, lang },
                  normaliseOutput
                });

                // Merge paraphrased content into obj
                obj = {
                  ...obj,
                  ...paraphrasedContent
                };

                obj.__meta = {
                  ...(obj.__meta || {}),
                  confidence: "medium",
                  evidence_status: "paraphrased",
                  indexable: true,
                  lang,
                  visibleTextLength: visibleText.length,
                  source: "max_retries_fallback"
                };
              } catch (err) {
                console.error(`❌ Paraphraser fallback failed for ${slug}: ${err.message}`);
                // Fall through to generic FAQ
              }
            }

            // If paraphraser didn't run or failed, use generic FAQ
            if (!obj.__meta?.evidence_status || obj.__meta.evidence_status !== "paraphrased") {
              console.warn(`⚠️  FAQ still not grounded → applying zero-cost generic fallback for ${slug}`);
              const display = (task?.displayName || name || slug || "").trim();
              obj.faqcontent = buildGeneralFaq(display, 5, slug);
              obj.__meta = {
                ...(obj.__meta || {}),
                confidence: obj.__meta?.confidence || "medium",
                evidence_status: "general",
                indexable: true,
                needsVerification: true
              };
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️  FAQ path error: ${e?.message || e}`);
        // Last-ditch: generic
        const display = (task?.displayName || name || slug || "").trim();
        obj.faqcontent = buildGeneralFaq(display, 5, slug);
        obj.__meta = {
          ...(obj.__meta || {}),
          confidence: obj.__meta?.confidence || "medium",
          evidence_status: "general",
          indexable: true,
          needsVerification: true
        };
      }
      // ==================== END FAQ PATH ====================

      // Now validate (operating on merged obj)
      const err = validatePayload(obj);
      if (err) throw new Error(`Validation failed: ${err}`);

      // Grounding check (ensure content is based on evidence)
      const groundErr = checkGrounding(obj, evidence);
      if (groundErr) throw new Error(groundErr);

      // Hard counts with auto-repair (skip checks on preserved fields)
      let fails = checkHardCounts(obj, preserved);
      if (fails.length) {
        let fixed = obj, tries = 0;
        while (tries < MAX_REPAIRS) {
          tries++;
          try {
            fixed = await repairToConstraints(task, fixed, fails);
            fails = checkHardCounts(fixed, preserved);
            if (!fails.length) { obj = fixed; break; }
          } catch (e) {
            if (tries >= MAX_REPAIRS) throw e;
          }
        }

        // Apply soft tolerance for word-count underruns in practice mode OR must-succeed mode
        if (fails.length && (!PRACTICE_STRICT || ACTIVE_POLICY.retryUntilSuccess)) {
          const tolerableFails = fails.filter(f => {
            const match = f.match(/^(\w+)\s+words\s+(\d+)\s+not\s+in\s+(\d+)\s*[–—-]\s*(\d+)$/i);
            if (match) {
              const [, , currentStr, minStr] = match;
              const current = parseInt(currentStr);
              const min = parseInt(minStr);
              return current >= (min - WORD_COUNT_TOLERANCE);
            }
            return false;
          });

          if (tolerableFails.length === fails.length) {
            // All failures are tolerable underruns - accept with warning
            const mode = ACTIVE_POLICY.retryUntilSuccess ? "must-succeed" : "practice mode";
            console.log(`⚠️  Soft tolerance applied: ${fails.join("; ")} (${mode})`);
            obj = fixed;
            fails = [];
          }
        }

        // Soft tolerance for step-level underruns in practice mode OR must-succeed mode
        if (fails.length && (!PRACTICE_STRICT || ACTIVE_POLICY.retryUntilSuccess)) {
          const allStepFailsTolerable = fails.every(f => {
            const m = f.match(/howtoredeem\s+step\s+(\d+)\s+words\s+(\d+)\s+not\s+in\s+(\d+)\s*[–—-]\s*(\d+)/i);
            if (!m) return true; // ignore non-step failures here
            const current = parseInt(m[2], 10);
            const min = parseInt(m[3], 10);
            return current >= (min - STEP_WORD_TOLERANCE);
          });

          if (allStepFailsTolerable) {
            const mode = ACTIVE_POLICY.retryUntilSuccess ? "must-succeed" : "practice mode";
            console.log(`⚠️  Soft step tolerance applied: ${fails.join("; ")} (${mode})`);
            obj = fixed;
            fails = []; // accept
          }
        }

        // Final escape hatch: soft-accept if must-succeed mode and only non-terminal format errors remain
        if (fails.length && ACTIVE_POLICY.retryUntilSuccess) {
          console.log(`⚠️  Must-succeed soft-accept: ${fails.join("; ")}`);
          obj.__meta = {
            ...(obj.__meta || {}),
            confidence: obj.__meta?.confidence || "medium",
            evidence_status: obj.__meta?.evidence_status || "general",
            indexable: true,
            soft_accept: true,
            validation_warnings: fails
          };
          obj = fixed; // use the best attempt
          fails = []; // clear to allow success
        }

        if (fails.length) throw new Error(`Count checks failed after repair: ${fails.join("; ")}`);
      }

      // Keyword density caps: run after structure/length normalization
      let kdFails = checkKeywordCaps(obj, name, preserved);
      if (kdFails.length) {
        let fixed = obj, tries = 0;
        while (tries < MAX_REPAIRS) {
          tries++;
          try {
            const repairPrompt =
              `Reduce keyword frequency to caps without changing meaning or adding facts beyond EVIDENCE.\n` +
              `Caps: primary ("${name} promo code") ≤ 1 per section; ` +
              `secondary ("save on ${name}" | "${name} discount" | "current offer" | "special offer") combined ≤ 2 per section.\n` +
              `Violations: ${kdFails.join("; ")}\n\nJSON:\n${JSON.stringify(fixed)}`;
            fixed = await task.callLLM(repairPrompt);
            kdFails = checkKeywordCaps(fixed, name, preserved);
            if (!kdFails.length) { obj = fixed; break; }
          } catch (e) {
            if (tries >= MAX_REPAIRS) throw e;
          }
        }
        if (kdFails.length) throw new Error(`Keyword density checks failed after repair: ${kdFails.join("; ")}`);
      }

      // Minimum presence rule: ensure primary keyword appears at least once in aboutcontent FIRST PARAGRAPH
      if (!preserved?.about) {
        let repaired = false; // Track if we repaired for later density re-check

        // Normalize name for SEO matching (handles Brand™, Brand®, etc.)
        const seoName = nameForSeo(name);
        const primaryRe = mkPrimaryPromoRegex(seoName);

        // Check FIRST PARAGRAPH only (enforces placement)
        const firstPara = firstParagraphText(obj.aboutcontent || "");
        const hasPrimary = primaryRe.test(firstPara);

        if (!hasPrimary) {
          // Observability: log when presence repair fires
          if (task.log) task.log(`presence_repair: enforced primary promo code for slug=${obj.slug}`);

          // Try auto-repair once
          try {
            const repairPrompt =
              `Ensure the FIRST paragraph of "aboutcontent" naturally includes ` +
              `"${name} promo code" EXACTLY ONCE (no stuffing). ` +
              `This is critical for SEO - Whop uses "promo code" terminology, not "discount". ` +
              `Keep meaning the same and do not add new facts beyond EVIDENCE. Return JSON only.\n\nJSON:\n${JSON.stringify(obj)}`;
            const fixed = await task.callLLM(repairPrompt);

            // Verify repair worked (check first paragraph)
            const firstParaFixed = firstParagraphText(fixed.aboutcontent || "");
            if (primaryRe.test(firstParaFixed)) {
              obj = fixed;
              repaired = true;
            }
          } catch (e) {
            // Fall through to error
          }
          if (!repaired) {
            // Must-succeed soft-accept: allow PK failures with warning
            if (ACTIVE_POLICY.retryUntilSuccess) {
              console.log(`⚠️  Must-succeed: accepting without primary keyword in first paragraph`);
              obj.__meta = {
                ...(obj.__meta || {}),
                confidence: obj.__meta?.confidence || "medium",
                evidence_status: obj.__meta?.evidence_status || "general",
                indexable: true,
                soft_accept: true,
                validation_warnings: [...(obj.__meta?.validation_warnings || []), `Primary keyword missing in first paragraph`]
              };
            } else {
              throw new Error(`Primary keyword ("${name} promo code") missing in aboutcontent first paragraph (min presence rule)`);
            }
          }
        }

        // Re-run density caps after presence repair (may have pushed over cap)
        if (repaired) {
          let kdFails2 = checkKeywordCaps(obj, name, preserved);
          if (kdFails2.length) {
            let fixed = obj, tries = 0;
            while (tries < MAX_REPAIRS) {
              tries++;
              try {
                const repairPrompt =
                  `Reduce keyword frequency to caps without changing meaning or adding facts beyond EVIDENCE.\n` +
                  `Caps: primary ("${name} promo code") ≤ 1 per section; ` +
                  `secondary ("save on ${name}" | "${name} discount" | "current offer" | "special offer") combined ≤ 2 per section.\n` +
                  `Violations: ${kdFails2.join("; ")}\n\nJSON:\n${JSON.stringify(fixed)}`;
                fixed = await task.callLLM(repairPrompt);
                kdFails2 = checkKeywordCaps(fixed, name, preserved);
                if (!kdFails2.length) { obj = fixed; break; }
              } catch (e) {
                if (tries >= MAX_REPAIRS) throw e;
              }
            }
            if (kdFails2.length) throw new Error(`Keyword density checks failed after presence repair: ${kdFails2.join("; ")}`);
          }
        }
      }

      // enforce slug echo
      obj.slug = slug;

      // Unit smoke test: assert first paragraph contains primary exactly once (if not preserved)
      if (!preserved?.about) {
        const seoName = nameForSeo(name);
        const primaryRe = mkPrimaryPromoRegex(seoName);
        const fp = firstParagraphText(obj.aboutcontent);
        const matches = (fp.match(primaryRe) || []).length;
        if (matches !== 1) {
          // Must-succeed soft-accept for PK count mismatch
          if (ACTIVE_POLICY.retryUntilSuccess) {
            console.log(`⚠️  Must-succeed: accepting PK count=${matches} (expected 1)`);
            obj.__meta = {
              ...(obj.__meta || {}),
              confidence: obj.__meta?.confidence || "medium",
              evidence_status: obj.__meta?.evidence_status || "general",
              indexable: true,
              soft_accept: true,
              validation_warnings: [
                ...(obj.__meta?.validation_warnings || []),
                `Primary keyword count: ${matches} (expected 1)`
              ]
            };
          } else {
            throw new Error(
              `aboutcontent first paragraph must contain primary keyword exactly once (found ${matches}×)`
            );
          }
        }
      }

      // Style/human-ness guard: sentence variation and readability
      if (!preserved?.about && !passesStyleBand(obj.aboutcontent, task.slug, true)) {
        throw new Error(
          "Style guard: aboutcontent needs more varied sentence length (human cadence). " +
          "Require ≥3 sentences, mean 13–22 words/sentence, stdev ≥4 for natural variation."
        );
      }

      // Ultra-strict primary keyword placement: must NOT appear outside aboutcontent
      if (!preserved?.about) {
        const seoName = nameForSeo(name);
        const primaryRe = mkPrimaryPromoRegex(seoName);

        for (const [field, check] of [["promodetailscontent", !preserved?.details], ["termscontent", !preserved?.terms], ["howtoredeemcontent", !preserved?.redeem]]) {
          if (check) {
            const hits = (stripTags(obj[field]).match(primaryRe) || []).length;
            if (hits > 0) {
              throw new Error(
                `${field}: primary keyword must not repeat outside aboutcontent (found ${hits}× - use secondary keywords only)`
              );
            }
          }
        }

        // Option A (strict): Also forbid primary in FAQ questions AND answers (avoid keyword stuffing)
        if (!preserved?.faq && Array.isArray(obj.faqcontent)) {
          for (const f of obj.faqcontent) {
            const combined = `${f.question || ""} ${f.answerHtml || ""}`;
            if (primaryRe.test(stripTags(combined))) {
              throw new Error(
                "faqcontent: primary keyword must not appear in FAQ questions or answers (avoid stuffing). " +
                "Use secondary keywords like 'discount', 'offer', 'current deal' in FAQs instead."
              );
            }
          }
        }
      }

      // Near-duplicate guard: cross-document originality check (n-gram Jaccard)
      if (!preserved?.about && isTooSimilarToRecent(obj.aboutcontent, 0.40)) {
        throw new Error(
          "Originality guard: aboutcontent is too similar to recent outputs (cross-doc similarity ≥40%). " +
          "LLM must generate unique phrasing."
        );
      }

      // CTA enforcement: ensure aboutcontent has a call-to-action closing
      if (!preserved?.about && !hasCTAClosing(obj.aboutcontent)) {
        // Auto-append deterministic CTA to last paragraph
        const cta = pickDeterministic(CTA_POOL, slug);
        const html = String(obj.aboutcontent || "");

        // Try to append to last <p> tag, otherwise create new <p>
        const lastPMatch = html.match(/(<p\b[^>]*>)([\s\S]*?)(<\/p>)(?![\s\S]*<p\b)/i);
        if (lastPMatch) {
          // Append to existing last paragraph
          const before = lastPMatch[1];
          const content = lastPMatch[2];
          const after = lastPMatch[3];
          const updated = before + content + " " + cta + after;
          obj.aboutcontent = html.replace(lastPMatch[0], updated);
        } else {
          // No <p> tags found, append as new paragraph
          obj.aboutcontent = html + `<p>${cta}</p>`;
        }

        // Post-CTA word-count check: ensure aboutcontent stays within 120-180 words
        const wordCount = countWords(obj.aboutcontent);
        if (wordCount > 180) {
          // Trim last sentence to stay within range
          const text = stripTags(obj.aboutcontent);
          const sentences = text.split(/(?<=[.!?])\s+/);
          if (sentences.length > 3) {
            // Remove last sentence and rebuild
            const trimmedSentences = sentences.slice(0, -1);
            const trimmedText = trimmedSentences.join(" ");
            // Rebuild HTML with trimmed content (simple paragraph wrapping)
            obj.aboutcontent = `<p>${trimmedText}</p>`;
          }
          // If still over 180, the hard-count validator will catch it and repair
        }
      }

      // Similarity guard (rewrite if too similar to recent)
      try {
        const h = hashOf(obj);
        let tooSimilar = false;
        for (const prev of simState.recent) {
          if (similarity(h, prev) >= SIM_THRESHOLD) { tooSimilar = true; break; }
        }
        if (tooSimilar) {
          const rewritePrompt = `
Rewrite this JSON to preserve factual constraints but vary phrasing and structure to avoid similarity.
Keep the same keys and allowed tags; do not change counts beyond the specified limits.
JSON:
${JSON.stringify(obj)}
`;
          const rr = await api.callLLM(rewritePrompt);
          const fb = rr.indexOf("{"); const lb = rr.lastIndexOf("}");
          let newObj = JSON.parse((fb >= 0 && lb > fb) ? rr.slice(fb, lb+1) : rr);
          newObj = sanitizePayload(newObj);
          const verr = validatePayload(newObj) || checkHardCounts(newObj)[0] || null;
          if (!verr) { obj = newObj; }
        }
        recordHash(hashOf(obj));
      } catch {}

      // Add evidence breadcrumb for audit trail (not imported to DB)
      const attempts = IGNORE_CHECKPOINT ? (retryCount.get(slug) || 1) : 1;
      const output = {
        ...obj,
        __meta: {
          sourceUrl: url,
          finalUrl: evidence?.finalUrl || url,
          evidenceHash: evidence?.textHash || null,
          drilled: evidence?.drilled || false,
          confidence: evidence?.evidenceSource ? (evidence.evidenceSource === "direct" ? "high" : "medium") : "high",
          evidence_status: evidence?.evidenceSource || "direct",
          indexable: true,
          attempt_count: attempts
        }
      };

      delete output.promodetails;

      // Fingerprint dedupe: avoid duplicate writes
      const sha = stableDigest(output);
      const prior = fingerprints.get(slug);

      // If digest unchanged, skip writing but mark done
      if (prior && prior === sha) {
        ck.done[slug] = true;
        delete ck.pending[slug];
        persistCheckpoint();
        return;
      }

      // Write output and update fingerprint (with write-once guard)
      appendOnce(OUT_FILE, output);
      appendFingerprint({ slug, sha });
      fingerprints.set(slug, sha);

      // IMMEDIATE ATOMIC APPEND to master (crash-safe for both updates and successes)
      if (!EVIDENCE_ONLY) {
        try {
          appendLineAtomic("data/content/master/updates.jsonl", output);
          appendLineAtomic("data/content/master/successes.jsonl", output);
          // Remove any stale reject for this slug
          removeRejectIfExists(slug);
        } catch (err) {
          console.error(`⚠️  Failed to append success to master: ${err.message}`);
        }
      }

      if (evidence?.drilled) drilledCount++;
      ck.done[slug] = true;
      delete ck.pending[slug];

      // Periodic consolidation (keeps master counts up-to-date during long runs)
      _successesSinceConsolidate++;
      if (_successesSinceConsolidate >= CONSOLIDATE_EVERY && !EVIDENCE_ONLY) {
        _successesSinceConsolidate = 0;
        console.log(`\n🔄 Running periodic consolidation (every ${CONSOLIDATE_EVERY} successes)...`);
        try {
          const { spawnSync } = await import("child_process");
          spawnSync("node", ["scripts/consolidate-results.mjs"], { stdio: "inherit" });
          spawnSync("node", ["scripts/audit-invariants.mjs"], { stdio: "inherit" });
          console.log(`✅ Consolidation complete\n`);
        } catch (e) {
          console.warn(`⚠️  Consolidation skipped: ${e.message}`);
        }
      }

      // Record fingerprint for cross-doc originality tracking
      if (!preserved?.about) {
        recordFingerprint(slug, obj.aboutcontent);
      }

      // Log evidence stats every 10 items (cheap observability)
      const doneCount = Object.keys(ck.done).length;
      if (doneCount % 10 === 0) {
        const stats = {
          slug,
          evidenceChars: evidence?.textSample?.length || 0,
          paras: evidence?.paras?.length || 0,
          bullets: evidence?.bullets?.length || 0,
          faq: evidence?.faq?.length || 0
        };
        console.log(`[Evidence Stats ${doneCount}] ${JSON.stringify(stats)}`);
      }

      // Save sample for QA if requested
      if (SAMPLE_EVERY && (Object.keys(ck.done).length % SAMPLE_EVERY === 0)) {
        fs.writeFileSync(path.join(SAMPLE_DIR, `${slug}.json`), JSON.stringify(obj, null, 2));
      }

      return;
    } catch (e) {
      const wait = 1000 * Math.pow(2, attempt-1) + Math.floor(Math.random()*400); // jitter
      if (attempt === 4) {
        // Escalate tough rows to a stronger model if configured
        if (ESCALATE_ON_FAIL && STRONG_MODEL) {
          try {
            const prevModel = MODEL;
            process.env.MODEL = STRONG_MODEL;
            const raw2 = await api.callLLM(prompt);
            const fb2 = raw2.indexOf("{"); const lb2 = raw2.lastIndexOf("}");
            let obj2 = JSON.parse((fb2 >= 0 && lb2 > fb2) ? raw2.slice(fb2, lb2+1) : raw2);

            // Sanitize model output first
            obj2 = sanitizePayload(obj2);

            // Apply same merge logic as main path
            const keep2 = (v) => Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim().length > 0);
            const preserved2 = {
              about: keep2(task.about),
              redeem: keep2(task.redeem),
              details: keep2(task.details),
              terms: keep2(task.terms),
              faq: !!(Array.isArray(task.faq) && task.faq.length)
            };

            obj2.aboutcontent        = preserved2.about   ? task.about   : obj2.aboutcontent;
            obj2.howtoredeemcontent  = preserved2.redeem  ? task.redeem  : obj2.howtoredeemcontent;
            obj2.promodetailscontent = preserved2.details ? task.details : obj2.promodetailscontent;
            obj2.termscontent        = preserved2.terms   ? task.terms   : obj2.termscontent;
            obj2.faqcontent          = preserved2.faq     ? task.faq     : obj2.faqcontent;

            // Re-sanitize after merge
            obj2 = sanitizePayload(obj2);

            // Validate + grounding check + hard counts on merged obj (skip checks on preserved fields)
            const err2 = validatePayload(obj2) || checkGrounding(obj2, evidence) || checkHardCounts(obj2, preserved2)[0] || null;
            if (err2) throw new Error(err2);
            obj2.slug = slug;
            recordHash(hashOf(obj2));

            // Add evidence breadcrumb for audit trail (not imported to DB)
            const attempts2 = IGNORE_CHECKPOINT ? (retryCount.get(slug) || 1) : 1;
            const output2 = {
              ...obj2,
              __meta: {
                sourceUrl: url,
                finalUrl: evidence?.finalUrl || url,
                evidenceHash: evidence?.textHash || null,
                drilled: evidence?.drilled || false,
                confidence: evidence?.evidenceSource ? (evidence.evidenceSource === "direct" ? "high" : "medium") : "high",
                evidence_status: evidence?.evidenceSource || "direct",
                indexable: true,
                attempt_count: attempts2
              }
            };

            delete output2.promodetails;

            // Fingerprint dedupe: avoid duplicate writes
            const sha2 = stableDigest(output2);
            const prior2 = fingerprints.get(slug);

            // If digest unchanged, skip writing but mark done
            if (prior2 && prior2 === sha2) {
              ck.done[slug] = true;
              delete ck.pending[slug];
              persistCheckpoint();
              process.env.MODEL = prevModel;
              return;
            }

            // Write output and update fingerprint
            fs.appendFileSync(OUT_FILE, JSON.stringify(output2) + "\n");
            appendFingerprint({ slug, sha: sha2 });
            fingerprints.set(slug, sha2);

            // IMMEDIATE ATOMIC APPEND to master (crash-safe)
            if (!EVIDENCE_ONLY) {
              try {
                appendLineAtomic("data/content/master/updates.jsonl", output2);
                appendLineAtomic("data/content/master/successes.jsonl", output2);
                // Remove any stale reject for this slug
                removeRejectIfExists(slug);
              } catch (err) {
                console.error(`⚠️  Failed to append success to master: ${err.message}`);
              }
            }

            if (evidence?.drilled) drilledCount++;
            ck.done[slug] = true;
            delete ck.pending[slug];
            process.env.MODEL = prevModel;

            // Periodic consolidation
            _successesSinceConsolidate++;
            if (_successesSinceConsolidate >= CONSOLIDATE_EVERY && !EVIDENCE_ONLY) {
              _successesSinceConsolidate = 0;
              console.log(`\n🔄 Running periodic consolidation (every ${CONSOLIDATE_EVERY} successes)...`);
              try {
                const { spawnSync } = await import("child_process");
                spawnSync("node", ["scripts/consolidate-results.mjs"], { stdio: "inherit" });
                spawnSync("node", ["scripts/audit-invariants.mjs"], { stdio: "inherit" });
                console.log(`✅ Consolidation complete\n`);
              } catch (e) {
                console.warn(`⚠️  Consolidation skipped: ${e.message}`);
              }
            }

            return;
          } catch (ee) {
            // fall through to reject
          }
        }
        // Record reject for manual review
        fs.appendFileSync(REJECTS_FILE, JSON.stringify({ slug, error: e.message }) + "\n");
        throw e;
      }
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function run() {
  if (DRY_RUN) {
    console.log("🔍 DRY-RUN MODE: Validating fetch/grounding without LLM calls");
  }

  // Pre-mark items that already have full content to avoid token spend
  let premarked = 0;
  for (const r of rows) {
    if (!ck.done[r.slug] && !ck.rejected[r.slug] && hasSufficientContent(r)) {
      ck.done[r.slug] = true;
      premarked++;
    }
  }
  if (premarked > 0) {
    persistCheckpoint();
    console.log(`⏩ Pre-marked ${premarked} whops with sufficient existing content (skipped)`);
  }

  // Build worklist: honor resume unless FORCE, optionally retry rejects
  let queue = rows.filter(r => {
    const done = ck.done[r.slug]; // use ck.done directly (updated by pre-marking)
    const wasRejected = ck.rejected && ck.rejected[r.slug];

    // IGNORE_CHECKPOINT mode: allow reattempts for targeted retry runs
    if (IGNORE_CHECKPOINT) {
      if (done || wasRejected) {
        console.warn(`⚠️  Reattempting ${r.slug} (IGNORE_CHECKPOINT=1)`);
      }
      return true; // process everything in the input list
    }

    if (FORCE) return RETRY_REJECTS ? true : !wasRejected;
    if (RETRY_REJECTS) return !done;                 // include previous rejects
    return !done && !wasRejected;                    // default: skip rejects
  });

  // Apply onlySlugs filter if specified
  if (args.onlySlugs) {
    const only = new Set(String(args.onlySlugs).split(",").map(s => s.trim()).filter(Boolean));

    // Strict-only guard: verify all requested slugs are eligible (unless IGNORE_CHECKPOINT)
    if (!IGNORE_CHECKPOINT) {
      const inQueue = new Set(queue.map(r => r.slug));
      const missing = [...only].filter(s => !inQueue.has(s));
      if (missing.length > 0) {
        console.error(`❌ Strict-only guard: ${missing.length} requested slugs are not eligible (already done/rejected or missing). Aborting.`);
        console.error("Examples:", missing.slice(0, 10).join(", "));
        process.exit(2);
      }
    }

    queue = queue.filter(r => only.has(r.slug));
    if (queue.length === 0) {
      console.error("No valid slugs to process (after onlySlugs + reject filtering).");
      process.exit(2);
    }
  }

  // Guard against empty workset
  if (queue.length === 0) {
    const completed = Object.keys(ck.done || {}).length;
    const rejected = Object.keys(ck.rejected || {}).length;
    const inflight = Object.keys(ck.pending || {}).length;
    const skipped = Math.max(rows.length - completed - rejected, 0);
    console.log(`Nothing to do. Completed=${completed} Rejected=${rejected} Inflight=${inflight} Skipped=${skipped}`);

    // Count actual reject lines
    try {
      const rejLines = fs.existsSync(REJECTS_FILE) ? (fs.readFileSync(REJECTS_FILE, "utf8").trim().split("\n").filter(Boolean).length) : 0;
      console.log(`Rejects in file: ${rejLines} (in ${REJECTS_FILE})`);
    } catch {}

    process.exit(0);
  }

  let i = 0, ok = 0, fail = 0;
  while (i < queue.length) {
    const slice = queue.slice(i, i + CONCURRENCY);
    try {
      await Promise.all(slice.map(r => worker(r)));
      ok += slice.length;
    } catch (e) {
      // Check if budget cap reached (graceful stop)
      if (e.message && e.message.includes("Budget cap reached")) {
        console.error(`\n⛔ ${e.message}`);
        console.log(`   Checkpoint saved at ${CHECKPOINT}`);
        console.log(`   OUT: ${OUT_FILE}`);
        console.log(`   REJ: ${REJECTS_FILE}`);
        console.log(`   Run completed items: ${ok}`);
        budget.persistRunMeta({ reason: "budget_cap_reached", itemsCompleted: ok, itemsFailed: fail });
        break;
      }
      console.error("Batch error:", e.message);
      fail += 1;
    } finally {
      persistCheckpoint();
      i += CONCURRENCY;
    }
    // polite pacing
    await new Promise(r => setTimeout(r, 500));

    // Progress logging every 100 successes
    if ((ok % 100 === 0) && ok > 0) {
      console.log(`Progress: ok=${ok}, batchFails=${fail}, tokens={in:${usageTotals.input}, out:${usageTotals.output}}`);
      const { spentUSD } = budget.summary();
      console.log(`Spent so far: $${spentUSD.toFixed(2)}`);
    }
  }
  console.log(`✅ Completed. Wrote to ${OUT_FILE}. Success=${ok}, batchFails=${fail}`);
  console.log(`Token usage summary: input=${usageTotals.input}, output=${usageTotals.output}`);
  if (drilledCount > 0) {
    console.log(`Hub drill-downs: ${drilledCount} (min=${PRODUCT_MIN_CHARS}, soft=${PRODUCT_SOFT_MIN}, gain≥300)`);
  }

  // Report rejects
  const rejectsCount = fs.existsSync(REJECTS_FILE) ? fs.readFileSync(REJECTS_FILE, "utf8").split(/\r?\n/).filter(Boolean).length : 0;
  console.log(`Rejects: ${rejectsCount} (logged in ${REJECTS_FILE})`);

  // Final token usage export for monitor (atomic write)
  writeJsonAtomic(USAGE_FILE, { input: usageTotals.input, output: usageTotals.output });

  // Persist budget usage meta to .usage.json
  budget.persistRunMeta({ reason: "completed_batch", itemsCompleted: ok, itemsFailed: fail, rejectsCount });

  // Release lock on successful completion
  try { fs.unlinkSync(LOCK); } catch {}
}

run().catch(err => {
  console.error("Fatal:", err);
  try { fs.unlinkSync(LOCK); } catch {}
  process.exit(1);
});

// Graceful shutdown on SIGINT (Ctrl+C) and SIGTERM (kill/CI/PM2)
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    try {
      persistCheckpoint();
      console.log(`\n🛑 ${sig} received. Checkpoint saved.`);
    } catch {}
    try { fs.unlinkSync(LOCK); } catch {}
    process.exit(sig === "SIGINT" ? 130 : 143);
  });
}
