// src/sync-ledgers-from-whpcodes.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const START_PAGE = parseInt(process.env.WHPCODES_START_PAGE || '1', 10);
const MAX_PAGES  = parseInt(process.env.WHPCODES_MAX_PAGES  || '999', 10);
const CONCURRENCY = parseInt(process.env.WHOP_CONCURRENCY   || '2', 10);
const HEADLESS = (process.env.HEADLESS ?? 'true') !== 'false';

const DATA_DIR = path.resolve(process.env.WHOP_DATA_DIR || path.join(__dirname, '..', 'data', 'pages'));
const COOKIE_PATH = process.env.WHOP_COOKIES || path.resolve(__dirname, '..', 'cookies.json'); // optional

// --- small utils ---
const ensureDir = async (dir) => fs.mkdir(dir, { recursive: true }).catch(()=>{});
const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const slugFromUrl = (u) => {
  const { pathname } = new URL(u);
  const clean = pathname.replace(/^\/|\/$/g, '');
  return clean.replace(/[^\w\-]+/g, '-').toLowerCase() || 'index';
};

async function loadCookies(context) {
  try {
    const txt = await fs.readFile(COOKIE_PATH, 'utf8');
    const cookies = JSON.parse(txt);
    if (Array.isArray(cookies) || cookies.cookies) {
      await context.addCookies(Array.isArray(cookies) ? cookies : cookies.cookies);
      console.log(`Loaded cookies from ${COOKIE_PATH}`);
    }
  } catch {}
}

async function collectWhopLinksFromWhpCodes(page) {
  const all = new Set();
  for (let p = START_PAGE; p < START_PAGE + MAX_PAGES; p++) {
    const url = `https://whpcodes.com/?page=${p}`;
    console.log(`Checking page ${p}: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    // Wait for content to load (client-side rendered)
    await page.waitForTimeout(3000);

    // Try multiple patterns for finding whop links
    const links = await page.$$eval('a', as =>
      Array.from(new Set(
        as
          .filter(a => {
            const text = (a.textContent || '').toLowerCase();
            // Look for various button patterns
            return /reveal.*code|go.*to.*page|visit.*site|get.*deal|claim.*code|exclusive.*access/i.test(text);
          })
          .map(a => a.href)
          .filter(h => /https?:\/\/(www\.)?whop\.com\//i.test(h))
      ))
    );

    // If no specific button links found, look for any whop.com links
    if (links.length === 0) {
      const anyWhop = await page.$$eval('a', as =>
        Array.from(new Set(
          as.map(a => a.href).filter(h => /https?:\/\/(www\.)?whop\.com\//i.test(h))
        ))
      );
      console.log(`Found ${anyWhop.length} fallback whop.com links on page ${p}`);
      anyWhop.forEach(h => all.add(h));
    } else {
      console.log(`Found ${links.length} button-linked whop.com links on page ${p}`);
      links.forEach(h => all.add(h));
    }

    // If still no links and this is first page, something might be wrong
    if (all.size === 0 && p === START_PAGE) {
      console.log('No whop.com links found on first page - checking page structure');
      const allLinks = await page.$$eval('a', as => as.length);
      console.log(`Total links on page: ${allLinks}`);
    }

    // If we haven't found any new links in this page and we have some already, break
    const sizeBefore = all.size;
    if (sizeBefore > 0 && links.length === 0) {
      break;
    }

    // tiny politeness delay
    await sleep(1000);
  }

  console.log(`Collected ${all.size} Whop links from whpcodes.com`);
  return Array.from(all);
}

function extractPromoFromText(text) {
  if (!text || !text.includes('popupPromoCode')) return [];
  const results = [];
  // Very forgiving regex for RSC/json blobs
  const codeMatch = /"popupPromoCode"\s*:\s*\{[^}]*"code"\s*:\s*"([^"]+)"/s.exec(text);
  if (codeMatch) {
    const amountMatch = /"popupPromoCode"\s*:\s*\{[^}]*"amountOff"\s*:\s*([0-9.]+)/s.exec(text);
    const discountMatch = /"popupPromoCode"\s*:\s*\{[^}]*"discountOff"\s*:\s*"([^"]+)"/s.exec(text);
    results.push({
      code: codeMatch[1],
      amountOff: amountMatch ? Number(amountMatch[1]) : null,
      discountOff: discountMatch ? discountMatch[1] : null,
    });
  }
  return results;
}

async function findPopupCodesForUrl(context, url) {
  const page = await context.newPage();
  const hits = new Map(); // code -> {code, amountOff, discountOff}

  const watcher = async (resp) => {
    try {
      const ct = (resp.headers()['content-type'] || '').toLowerCase();
      if (!/json|text|javascript|stream|octet/.test(ct)) return;
      const body = await resp.text();
      if (!body || !body.includes('popupPromoCode')) return;
      for (const h of extractPromoFromText(body)) {
        if (!hits.has(h.code)) hits.set(h.code, h);
      }
    } catch {}
  };
  page.on('response', watcher);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(()=>{});
    // force a reload to catch RSC streams again
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(()=>{});
  } catch (e) {
    console.log(`❌ load error ${url}: ${e.message}`);
  } finally {
    await page.close().catch(()=>{});
  }

  return Array.from(hits.values());
}

async function readJson(fp) {
  try { return JSON.parse(await fs.readFile(fp, 'utf8')); }
  catch { return null; }
}

async function upsertLedger(whopUrl, finds) {
  if (!finds.length) return false;

  await ensureDir(DATA_DIR);
  const slug = slugFromUrl(whopUrl);
  const fp = path.join(DATA_DIR, `${slug}.json`);
  const now = nowIso();

  const existing = (await readJson(fp)) ?? { whopUrl, lastUpdated: now, ledger: [] };
  existing.whopUrl = existing.whopUrl || whopUrl;
  existing.ledger = Array.isArray(existing.ledger) ? existing.ledger : [];

  let changed = false;
  for (const f of finds) {
    let row = existing.ledger.find(r => r.code === f.code);
    if (!row) {
      row = {
        code: f.code,
        maskInLedger: true,     // never expose in freshness band
        status: 'unknown',      // we didn't test checkout here
        before: undefined,
        after: undefined,
        notes: '',
        checkedAt: now
      };
      if (f.discountOff != null) row.discountOff = f.discountOff;
      if (f.amountOff != null)   row.amountOff   = f.amountOff;
      existing.ledger.push(row);
      changed = true;
    } else {
      // refresh checkedAt + fill any missing meta
      if (row.checkedAt !== now) { row.checkedAt = now; changed = true; }
      if (f.discountOff != null && !row.discountOff) { row.discountOff = f.discountOff; changed = true; }
      if (f.amountOff   != null && row.amountOff == null) { row.amountOff = f.amountOff; changed = true; }
      if (row.maskInLedger !== true) { row.maskInLedger = true; changed = true; }
    }
  }

  if (changed) {
    existing.lastUpdated = now;
    await fs.writeFile(fp, JSON.stringify(existing, null, 2));
    console.log(`✅ updated: ${fp} (${finds.length} code(s))`);
  } else {
    console.log(`→ no change: ${fp}`);
  }
  return changed;
}

async function run() {
  await ensureDir(DATA_DIR);
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ locale: 'en-GB', timezoneId: 'Europe/London' });
  await loadCookies(context); // optional login

  const page = await context.newPage();
  const urls = await collectWhopLinksFromWhpCodes(page);
  await page.close();

  // Simple pool runner
  let i = 0, active = 0, updatedCount = 0, foundCodes = 0;
  const next = async () => {
    if (i >= urls.length) return;
    const url = urls[i++]; active++;
    try {
      const finds = await findPopupCodesForUrl(context, url);
      if (finds.length) {
        foundCodes += finds.length;
        const changed = await upsertLedger(url, finds);
        if (changed) updatedCount++;
      } else {
        console.log(`— no popupPromoCode: ${url}`);
      }
    } catch (e) {
      console.log(`⚠️ error on ${url}: ${e.message}`);
    } finally {
      active--;
      if (i < urls.length) await next();
    }
  };

  const starters = Math.min(CONCURRENCY, urls.length);
  await Promise.all(Array.from({ length: starters }, () => next()));

  await context.close();
  await browser.close();

  console.log(`\nDone. URLs: ${urls.length} | pages updated: ${updatedCount} | codes found: ${foundCodes}`);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});