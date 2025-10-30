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

// Ensure fetch is available (Node <18 compatibility)
if (typeof fetch !== "function") {
  const { fetch: undiciFetch } = await import("undici");
  global.fetch = undiciFetch;
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

const IN = args.in || (fs.existsSync("data/neon/whops.jsonl") ? "data/neon/whops.jsonl" : "data/neon/whops.csv");
const OUT_DIR = "data/content/raw";
const CHECKPOINT = "data/content/.checkpoint.json";
const FINGERPRINTS_FILE = "data/content/.fingerprints.jsonl";

// === [PATCH] Overrides + CSV logging =========================================
const OVERRIDES_FILE = "data/overrides/hub-product-map.json";      // { "<creator-slug>": "/creator/product-slug/" }
const REVIEW_CSV     = "data/content/hub-review.csv";              // unresolved hubs
const OVERRIDE_HITS  = "data/content/hub-override-hits.csv";       // when an override is used

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
const WORD_COUNT_TOLERANCE = 10; // allow ≥ min-10 in practice/testing to prevent budget burn on edge cases

// Evidence fetching configuration
const EVIDENCE_TTL_DAYS = Number(process.env.EVIDENCE_TTL_DAYS || 7);
const MAX_HOST_CONCURRENCY = Number(process.env.MAX_HOST_CONCURRENCY || 2);
const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(",").map(h => h.trim()) : [];
const RESPECT_ROBOTS = process.env.RESPECT_ROBOTS === "1";
const FORCE_RECRAWL = !!args.forceRecrawl;

// Configure your token-to-USD map (rough; adjust as needed)
const PRICE = {
  openai: { in: 0.00015/1000, out: 0.00060/1000 }, // $/token, example for gpt-4o-mini
  anthropic: { in: 0.00080/1000, out: 0.00120/1000 }, // adjust if you ever use it
};

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync("data/neon")) fs.mkdirSync("data/neon", { recursive: true });

// Guard against concurrent runs
const LOCK = path.join(OUT_DIR, ".run.lock");
if (fs.existsSync(LOCK)) {
  console.error("❌ Another run appears active (lock present).");
  console.error("   If no other process is running, remove: data/content/raw/.run.lock");
  process.exit(1);
}
fs.writeFileSync(LOCK, String(process.pid));

const PROVIDER = process.env.PROVIDER || "openai"; // or "anthropic"
const MODEL = process.env.MODEL || "";
if (!MODEL) {
  console.error("❌ MODEL env is required (e.g., MODEL=gpt-4.x or claude-x).");
  process.exit(1);
}

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
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 (+${os.hostname()})`,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });
    const text = await res.text();
    return {
      status: res.status,
      text,
      url: res.url || url, // final URL after redirects
      headers: res.headers
    };
  } finally {
    clearTimeout(t);
  }
}

// Extract structured evidence from HTML
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

  return {
    baseUrl,
    title,
    h1,
    bullets: liMatches.slice(0, 80),
    paras: pMatches,
    priceTokens: priceish,
    faq,
    textSample: longText
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
    const { status, text, url: fetchedUrl, headers } = await fetchHttp(url);
    let finalUrl = fetchedUrl;  // mutable for drill-down reassignment

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

      // Thin evidence guard: require minimum signal
      const contentCount = (ex.paras?.length || 0) + (ex.bullets?.length || 0);
      if (contentCount < 6 && textLength < 800) {
        throw new Error(`Insufficient evidence: ${contentCount} content blocks, ${textLength} chars`);
      }

      const evidence = {
        ...ex,
        finalUrl, // store final URL after redirects
        fetchedAt: new Date().toISOString(),
        textHash: sha256(ex.textSample || ""),
        drilled // track if hub drill-down was used
      };
      fs.writeFileSync(cachePath, JSON.stringify(evidence, null, 2));
      return evidence;
    }
    // Mark rate-limit errors as retryable
    if (status === 429 || status === 403) {
      throw Object.assign(new Error(`Rate limited (${status})`), { retryable: true });
    }
    throw new Error(`Unable to fetch evidence (status ${status})`);
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
      // Budget check before each attempt
      if (BUDGET_USD > 0) {
        const p = PRICE[PROVIDER.toLowerCase()] || PRICE.openai;
        const currentCost = (usageTotals.input * p.in) + (usageTotals.output * p.out);
        if (currentCost >= BUDGET_USD) {
          throw new Error(`Budget exceeded: $${currentCost.toFixed(2)} >= $${BUDGET_USD}`);
        }
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

1. aboutcontent (130-170 words, HARD MIN 120, 2-3 short paragraphs):
   - MUST include "[name] promo code" naturally in the first paragraph (critical for SEO - Whop uses "promo code" terminology).
   - Optionally sprinkle "discount", "offer", or "save on [name]" as secondary keywords (≤2 total).
   - Explain what the course or product is and why it's useful.
   - Conditional platform mention: if on whop.com, you may mention "Whop" once.
   - End with a varied call-to-action (explore/compare/check/start/look pattern - vary phrasing per listing to avoid Google fingerprinting).
   - Use Grade 8-10 English, varied sentence lengths (≥3 sentences with mean 13–22 words, stdev ≥4 for human cadence).
   - **HARD MINIMUM**: If your draft is under 120 words, continue the paragraph until you reach at least 120 words. Do not end early.

2. promodetailscontent (100-150 words):
   - Include a <ul> list of 3-5 bullet points summarizing key benefits or pricing tiers.
   - Use "current offer" or "available discount" (avoid "verified" unless evidenced).
   - Focus on value propositions and what makes this offer unique.
   - CRITICAL: Start each bullet with an action verb (imperative voice: Use/Apply/Access/Choose/Get/Select/etc.).

3. howtoredeemcontent (3-5 short steps, 10-20 words each):
   - CRITICAL: Start each step with an action verb (imperative voice: Click/Copy/Apply/Confirm/Visit/Navigate/Enter/etc.).
   - Format as <ol> ordered list for clear step-by-step guidance.
   - Conditional platform mention: if on whop.com, you may mention "Whop.com" in redemption steps.

4. termscontent (80-120 words total, 3-5 concise bullets):
   - Include mention of expiry, usage limits, or platform terms (conditional).
   - Example bullet: "Discounts may vary by creator or course category."
   - Keep tone informative but not restrictive.

5. faqcontent (ARRAY of 4-6 FAQ objects, Schema.org FAQPage optimized):
   - CRITICAL: Return as JSON array: [{"question": "...", "answerHtml": "..."}, ...]
   - Each answer: 40-70 words, friendly, complete sentences.
   - NEVER single-word replies ("Yes", "No"). Always explain and expand.
   - Cover topics like: "How do I use [name] promo codes?", "Can I stack multiple offers?", "Is this deal legitimate?".
   - CRITICAL: Vary question openers (≥3 distinct when n≥4: How/What/Can/Where/Is/Do/etc.). Avoid repetitive "How do I..." patterns.
   - Include semantic variations of target keywords naturally.

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
- Provide complete, helpful information that builds user trust.`;

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
howtoredeemcontent: ${hasRedeem ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 3-5 steps]"}
promodetailscontent: ${hasDetails ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 100-150 words]"}
termscontent: ${hasTerms ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 80-120 words]"}
faqcontent: ${hasFaq ? "[PRESENT - KEEP AS-IS]" : "[MISSING - GENERATE 3-6 FAQs, 40-70 words/answer]"}

EVIDENCE (ordered, truncated):
${evChunks.map((s, i) => `[${i + 1}] ${s}`).join("\n")}

SEO WRITING GUIDELINES:
- aboutcontent: MUST include "${safeName} promo code" naturally in first paragraph. ${isWhopHost ? 'You may mention "Whop" once.' : 'Do not mention Whop.'} End with varied CTA.
- promodetailscontent: Use "current offer", "special offer", or "${safeName} discount" as secondary keywords. ${hasVerified ? 'You may use "verified" if appropriate.' : 'Avoid "verified".'} Focus on value props.
- howtoredeemcontent: ${isWhopHost ? 'You may mention "Whop.com" once in redemption steps.' : 'Do not mention Whop.com.'}
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

const stamp = new Date().toISOString().replace(/[-:]/g,"").replace(/\..+/, "");
const OUT_FILE = path.join(OUT_DIR, `ai-run-${stamp}.jsonl`);
const REJECTS_FILE = path.join(OUT_DIR, `rejects-${stamp}.jsonl`);
const USAGE_FILE = "data/content/.usage.json";
const RUN_META = path.join(OUT_DIR, `ai-run-${stamp}.meta.json`);

fs.writeFileSync(OUT_FILE, ""); // init
fs.writeFileSync(REJECTS_FILE, ""); // init

// Write run metadata
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

// Checkpoint
let ck = { done: {}, pending: {} };
if (fs.existsSync(CHECKPOINT)) {
  try { ck = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8")); } catch {}
}

// Prune stale pending entries (from crashed runs)
const MAX_PENDING_AGE_MS = 30 * 60 * 1000; // 30 min
const now = Date.now();
for (const [slug, ts] of Object.entries(ck.pending || {})) {
  if (!ts || now - Number(ts) > MAX_PENDING_AGE_MS) delete ck.pending[slug];
}
fs.writeFileSync(CHECKPOINT, JSON.stringify(ck, null, 2));

const alreadyDone = new Set(Object.keys(ck.done || {}));

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
function passesStyleBand(html) {
  const { sentences, meanSentLen, stdevSentLen } = textStats(html);
  // Enforce: ≥3 sentences, mean 13–22 words, stdev ≥4 (mixed short/long)
  return sentences >= 3 && meanSentLen >= 13 && meanSentLen <= 22 && stdevSentLen >= 4;
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
  // Check: first token is an action verb (imperative)
  const ok = lis.every(li => {
    const first = (stripTags(li).trim().match(/^[a-z]+/i) || [""])[0].toLowerCase();
    return /^(use|apply|click|select|choose|check|copy|paste|enter|join|start|verify|review|visit|navigate|open|go|follow|access|confirm|complete|view|find|locate|add|enable|accept|claim|redeem|activate|save)$/.test(first);
  });
  return ok;
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

  // helper
  const wc = (html) => countWords(html);
  const liCount = (html) => countTags(html || "", "li");
  const paraCount = (html) => countTags(html || "", "p");

  // ABOUT: paragraphs + words
  if (!preserved?.about && obj.aboutcontent) {
    const p = paraCount(obj.aboutcontent);
    if (p && (p < T.aboutParagraphsMin || p > T.aboutParagraphsMax)) {
      errs.push(`aboutcontent paragraphs ${p} not in ${T.aboutParagraphsMin}–${T.aboutParagraphsMax}`);
    }
    const w = wc(obj.aboutcontent);
    if (w && (w < T.aboutWordsMin || w > T.aboutWordsMax)) {
      errs.push(`aboutcontent words ${w} not in ${T.aboutWordsMin}–${T.aboutWordsMax}`);
    }
  }

  // REDEEM: steps 3–5, each step 10–20 words
  if (!preserved?.redeem && obj.howtoredeemcontent) {
    // ensure ordered list wrapper
    const hasOl = /<ol\b[^>]*>[\s\S]*<\/ol>/i.test(obj.howtoredeemcontent || "");
    if (!hasOl) errs.push(`howtoredeemcontent must use <ol> for steps`);

    const steps = liCount(obj.howtoredeemcontent);
    if (steps && (steps < T.redeemStepsMin || steps > T.redeemStepsMax)) {
      errs.push(`howtoredeem steps ${steps} not in ${T.redeemStepsMin}–${T.redeemStepsMax}`);
    }
    // per-step word counts
    const stepMatches = String(obj.howtoredeemcontent).match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
    stepMatches.forEach((li, i) => {
      const words = wc(li);
      if (words && (words < T.redeemStepWordsMin || words > T.redeemStepWordsMax)) {
        errs.push(`howtoredeem step ${i + 1} words ${words} not in ${T.redeemStepWordsMin}–${T.redeemStepWordsMax}`);
      }
    });
  }

  // DETAILS: bullets + words
  if (!preserved?.details && obj.promodetailscontent) {
    const b = liCount(obj.promodetailscontent);
    if (b && (b < T.detailsBulletsMin || b > T.detailsBulletsMax)) {
      errs.push(`promodetails bullets ${b} not in ${T.detailsBulletsMin}–${T.detailsBulletsMax}`);
    }
    const w = wc(obj.promodetailscontent);
    if (w && (w < T.detailsWordsMin || w > T.detailsWordsMax)) {
      errs.push(`promodetails words ${w} not in ${T.detailsWordsMin}–${T.detailsWordsMax}`);
    }
  }

  // TERMS: bullets + words
  if (!preserved?.terms && obj.termscontent) {
    const b = liCount(obj.termscontent);
    if (b && (b < T.termsBulletsMin || b > T.termsBulletsMax)) {
      errs.push(`terms bullets ${b} not in ${T.termsBulletsMin}–${T.termsBulletsMax}`);
    }
    const w = wc(obj.termscontent);
    if (w && (w < T.termsWordsMin || w > T.termsWordsMax)) {
      errs.push(`terms words ${w} not in ${T.termsWordsMin}–${T.termsWordsMax}`);
    }
  }

  // FAQ: 3–6 items, each answer 40–70 words
  if (!preserved?.faq && Array.isArray(obj.faqcontent)) {
    const n = obj.faqcontent.length;
    if (n && (n < T.faqCountMin || n > T.faqCountMax)) {
      errs.push(`faq count ${n} not in ${T.faqCountMin}–${T.faqCountMax}`);
    }
    for (let i = 0; i < obj.faqcontent.length; i++) {
      const ans = obj.faqcontent[i]?.answerHtml || "";
      const w = wc(ans);
      if (w && (w < T.faqAnswerWordsMin || w > T.faqAnswerWordsMax)) {
        errs.push(`faq answer ${i + 1} words ${w} not in ${T.faqAnswerWordsMin}–${T.faqAnswerWordsMax}`);
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

  // Check FAQ answers (skip if entire FAQ was preserved)
  if (!preserved?.faq && Array.isArray(obj.faqcontent)) {
    for (const qa of obj.faqcontent) {
      if (qa?.answerHtml && !grounded(qa.answerHtml)) {
        groundFails.push("faq answer not grounded");
        break;
      }
    }
  }

  return groundFails.length > 0 ? `Grounding check failed: ${groundFails[0]}` : null;
}

async function repairToConstraints(task, obj, fails) {
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
  fixed = sanitizePayload(fixed);
  const err = validatePayload(fixed) || checkHardCounts(fixed)[0] || null;
  if (err) throw new Error(`Repair failed: ${err}`);
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

  // Validate URL exists
  if (!url || !/^https?:\/\//i.test(url)) {
    fs.appendFileSync(REJECTS_FILE, JSON.stringify({ slug, error: "Missing or invalid URL" }) + "\n");
    return;
  }

  // Fetch evidence from URL
  let evidence;
  try {
    const forceRecrawl = FORCE_RECRAWL || task.forceRecrawl;
    evidence = await obtainEvidence(url, slug, name, forceRecrawl);
  } catch (e) {
    fs.appendFileSync(REJECTS_FILE, JSON.stringify({ slug, error: `Evidence fetch failed: ${e.message}` }) + "\n");
    return;
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
    fs.appendFileSync(OUT_FILE, JSON.stringify(dryOutput) + "\n");
    if (evidence?.drilled) drilledCount++;
    ck.done[slug] = true;
    delete ck.pending[slug];
    fs.writeFileSync(CHECKPOINT, JSON.stringify(ck, null, 2));
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
  fs.writeFileSync(CHECKPOINT, JSON.stringify(ck, null, 2));

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

        // Apply soft tolerance for word-count underruns in practice/small-batch mode
        if (fails.length && (BUDGET_USD <= 5 || LIMIT <= 10)) {
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
            console.log(`⚠️  Soft tolerance applied: ${fails.join("; ")} (practice mode)`);
            obj = fixed;
            fails = [];
          }
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
            throw new Error(`Primary keyword ("${name} promo code") missing in aboutcontent first paragraph (min presence rule)`);
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
          throw new Error(
            `aboutcontent first paragraph must contain primary keyword exactly once (found ${matches}×)`
          );
        }
      }

      // Style/human-ness guard: sentence variation and readability
      if (!preserved?.about && !passesStyleBand(obj.aboutcontent)) {
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
      const output = {
        ...obj,
        __meta: {
          sourceUrl: url,
          finalUrl: evidence?.finalUrl || url,
          evidenceHash: evidence?.textHash || null,
          drilled: evidence?.drilled || false
        }
      };

      fs.appendFileSync(OUT_FILE, JSON.stringify(output) + "\n");
      if (evidence?.drilled) drilledCount++;
      ck.done[slug] = true;
      delete ck.pending[slug];

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
            const output2 = {
              ...obj2,
              __meta: {
                sourceUrl: url,
                finalUrl: evidence?.finalUrl || url,
                evidenceHash: evidence?.textHash || null,
                drilled: evidence?.drilled || false
              }
            };

            fs.appendFileSync(OUT_FILE, JSON.stringify(output2) + "\n");
            if (evidence?.drilled) drilledCount++;
            ck.done[slug] = true;
            delete ck.pending[slug];
            process.env.MODEL = prevModel;
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
  const queue = rows.filter(r => !alreadyDone.has(r.slug));
  let i = 0, ok = 0, fail = 0;
  while (i < queue.length) {
    const slice = queue.slice(i, i + CONCURRENCY);
    try {
      await Promise.all(slice.map(r => worker(r)));
      ok += slice.length;
    } catch (e) {
      console.error("Batch error:", e.message);
      fail += 1;
    } finally {
      fs.writeFileSync(CHECKPOINT, JSON.stringify(ck, null, 2));
      i += CONCURRENCY;
    }
    // polite pacing
    await new Promise(r => setTimeout(r, 500));

    // Progress logging every 100 successes
    if ((ok % 100 === 0) && ok > 0) {
      console.log(`Progress: ok=${ok}, batchFails=${fail}, tokens={in:${usageTotals.input}, out:${usageTotals.output}}`);
      // Export real token usage for monitor (atomic write)
      writeJsonAtomic(USAGE_FILE, { input: usageTotals.input, output: usageTotals.output });
    }

    // Budget cap check
    if (BUDGET_USD) {
      const p = PRICE[PROVIDER] || PRICE.openai;
      const spent = usageTotals.input * p.in + usageTotals.output * p.out;
      // naive projection to total based on completion ratio
      const ratio = ok / Math.max(1, queue.length);
      const projected = spent / Math.max(0.01, ratio);
      if (projected > BUDGET_USD) {
        console.warn(`⛔ Budget cap hit. Spent so far ~$${spent.toFixed(2)}; projected ~$${projected.toFixed(2)} > $${BUDGET_USD}. Stopping.`);
        break;
      }
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
      fs.writeFileSync(CHECKPOINT, JSON.stringify(ck, null, 2));
      console.log(`\n🛑 ${sig} received. Checkpoint saved.`);
    } catch {}
    try { fs.unlinkSync(LOCK); } catch {}
    process.exit(sig === "SIGINT" ? 130 : 143);
  });
}
