#!/usr/bin/env node
/**
 * 🔍 WHP Codes Rendering Strategy Audit
 *
 * Discovers and classifies pages as SSG, SSR, or CSR based on actual HTML analysis.
 *
 * Classification logic:
 * - SSG: Full HTML content + cache HIT header
 * - SSR: Full HTML content but no cache header
 * - CSR: Missing critical content in raw HTML (hydration-only)
 *
 * Usage:
 *
 * Sitemap mode (default - only indexed pages):
 *   node audit-rendering-strategy.mjs
 *   node audit-rendering-strategy.mjs --sitemap https://whpcodes.com/sitemap.xml --limit 500
 *
 * Crawl mode (discovers ALL pages including noindex):
 *   node audit-rendering-strategy.mjs --crawl https://whpcodes.com/
 *   node audit-rendering-strategy.mjs --crawl https://whpcodes.com/ --limit 5000
 *
 * ISR probe mode (double-fetch to catch warm ISR pages):
 *   node audit-rendering-strategy.mjs --crawl https://whpcodes.com/ --probe-isr
 *
 * Flags:
 *   --crawl <url>    Enable crawl mode starting from URL (discovers all internal pages)
 *   --sitemap <url>  Sitemap URL to fetch (default: https://whpcodes.com/sitemap.xml)
 *   --limit <n>      Max pages to audit (default: 200 sitemap, 10000 crawl)
 *   --out <file>     Output CSV filename (default: rendering-audit.csv)
 *   --probe-isr      Enable double-fetch probe to detect warm ISR pages
 */

import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import fs from 'fs/promises';

const parseXML = promisify(parseString);
const gunzip = promisify(zlib.gunzip);

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (flag, defaultVal) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
};
const hasFlag = (flag) => args.includes(flag);

// Configuration
const CRAWL_MODE = hasFlag('--crawl');
const START_URL = getArg('--crawl', 'https://whpcodes.com/');
const SITEMAP_URL = getArg('--sitemap', 'https://whpcodes.com/sitemap.xml');
const MAX_PAGES = parseInt(getArg('--limit', CRAWL_MODE ? '10000' : '200'), 10);
const OUTPUT_CSV = getArg('--out', 'rendering-audit.csv');
const USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const DOUBLE_FETCH_ISR = hasFlag('--probe-isr');

// Fetch URL with proper headers
async function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
      }
    };

    const req = client.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          html: data,
          headers: res.headers,
          statusCode: res.statusCode
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Fetch and decompress .gz sitemaps
async function fetchXMLorGzip(url) {
  const { html, headers } = await fetchURL(url);
  const contentType = headers['content-type'] || '';
  const isGzip = url.endsWith('.gz') || /application\/gzip/i.test(contentType);

  if (isGzip) {
    const buffer = Buffer.from(html, 'binary');
    const decompressed = await gunzip(buffer);
    return decompressed.toString('utf8');
  }

  return html;
}

// Simple internal crawler (BFS) - discovers all internal pages
async function crawlSite(startUrl, limit = 3000, sameHostOnly = true) {
  const origin = new URL(startUrl).origin;
  const seen = new Set();
  const queue = [startUrl];
  const urls = [];

  console.log(`🕷️  Starting crawl from: ${startUrl}`);
  console.log(`   Max pages: ${limit}, Same host only: ${sameHostOnly}\n`);

  while (queue.length && urls.length < limit) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      process.stdout.write(`\r🔍 Discovered: ${urls.length} pages | Queue: ${queue.length} | Checking: ${url.substring(0, 50)}...`);

      const { html, headers, statusCode } = await fetchURL(url);
      urls.push(url);

      // Extract internal links
      const linkHrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
        .map(m => m[1])
        .filter(href => {
          if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
          try {
            const u = new URL(href, url);
            return (!sameHostOnly || u.origin === origin) && ['http:', 'https:'].includes(u.protocol);
          } catch {
            return false;
          }
        })
        .map(href => {
          try {
            return new URL(href, url).toString();
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      for (const h of linkHrefs) {
        if (!seen.has(h) && urls.length + queue.length < limit) queue.push(h);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      // Ignore fetch errors for discovery
    }
  }

  console.log(`\n✅ Crawl complete: discovered ${urls.length} pages\n`);
  return urls;
}

// Extract URLs from sitemap (handles sitemap indexes, child sitemaps, and .gz)
async function fetchSitemap(sitemapUrl) {
  console.log(`📡 Fetching sitemap from: ${sitemapUrl}`);

  const xml = await fetchXMLorGzip(sitemapUrl);
  const result = await parseXML(xml);

  let urls = [];

  // Handle sitemap index (contains child sitemaps)
  if (result.sitemapindex?.sitemap) {
    console.log(`📚 Found sitemap index with ${result.sitemapindex.sitemap.length} child sitemaps`);
    const children = result.sitemapindex.sitemap.map(s => s.loc[0]);

    for (const child of children) {
      console.log(`  📄 Fetching child sitemap: ${child}`);
      try {
        const childXml = await fetchXMLorGzip(child);
        const childResult = await parseXML(childXml);

        if (childResult.urlset?.url) {
          const childUrls = childResult.urlset.url.map(u => u.loc[0]);
          urls.push(...childUrls);
          console.log(`    ✅ Added ${childUrls.length} URLs`);
        }
      } catch (err) {
        console.log(`    ⚠️  Failed to fetch child: ${err.message}`);
      }
    }
  }
  // Handle direct sitemap
  else if (result.urlset?.url) {
    urls = result.urlset.url.map(entry => entry.loc[0]);
  }

  console.log(`✅ Found ${urls.length} total URLs`);
  return urls;
}

// Analyze HTML content to determine rendering type
function analyzeHTML(html, headers, url, statusCode) {
  const analysis = {
    url,
    hasTitle: false,
    hasDescription: false,
    hasDiscountText: false,
    hasBadges: false,
    hasJsonLD: false,
    nextDataSize: 0,
    cacheHeader: headers['x-vercel-cache'] || headers['x-cache'] || 'none',
    cfCacheStatus: headers['cf-cache-status'] || 'none',
    contentLength: html.length,
    notes: []
  };

  // Check for redirects
  if (statusCode >= 300 && statusCode < 400 && headers.location) {
    analysis.notes.push(`Redirected -> ${headers.location}`);
  }

  // Check for actual content (not just structure)
  analysis.hasTitle = /<h1[^>]*>(?!.*loading|.*skeleton)[^<]+<\/h1>/i.test(html);
  analysis.hasDescription = /<meta\s+name=["']description["']\s+content=["'](?!.*Loading|.*Please wait)[^"']{20,}["']/i.test(html);

  // Check for discount/promo specific content
  analysis.hasDiscountText = /\b\d{1,3}%\s*(?:off|discount)\b/i.test(html);
  analysis.hasBadges = /\b(verified|working|expired|exclusive|evidence|alternatives|recommendations)\b/i.test(html);

  // Check for JSON-LD structured data
  const jsonLDMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLDMatch && jsonLDMatch[1]) {
    try {
      const jsonLD = JSON.parse(jsonLDMatch[1]);
      analysis.hasJsonLD = !!(jsonLD['@type'] || jsonLD.name);
    } catch (e) {
      // Invalid JSON-LD
    }
  }

  // Check __NEXT_DATA__ size
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch && nextDataMatch[1]) {
    analysis.nextDataSize = nextDataMatch[1].length;
  }

  // Check for skeleton/loading indicators
  if (/loading|skeleton|placeholder|spinner/i.test(html)) {
    analysis.notes.push('Has loading indicators');
  }

  // Check for empty hydration root
  if (/<div id="__next"><\/div>/.test(html) || /<div id="__next">\s*<\/div>/.test(html)) {
    analysis.notes.push('Empty __next root');
  }

  return analysis;
}

// Classify page based on analysis
function classifyPage(analysis) {
  // Loosen content gate: accept any of title, discount, badges, or JSON-LD
  const hasRealContent = analysis.hasTitle ||
                        analysis.hasDiscountText ||
                        analysis.hasBadges ||
                        analysis.hasJsonLD;

  // Include Cloudflare cache status in detection
  const hasCacheHit = /(hit|stale)/i.test(
    String(analysis.cacheHeader) + ' ' + String(analysis.cfCacheStatus)
  );
  const hasEmptyRoot = analysis.notes.includes('Empty __next root');

  // CSR: No real content or empty root
  if (!hasRealContent || hasEmptyRoot) {
    return {
      type: 'CSR',
      confidence: hasEmptyRoot ? 'high' : 'medium',
      reason: hasEmptyRoot
        ? 'Empty hydration root - content loaded client-side'
        : 'Missing critical content in HTML'
    };
  }

  // SSG: Real content + cache hit
  if (hasRealContent && hasCacheHit) {
    return {
      type: 'SSG',
      confidence: 'high',
      reason: 'Full content + cache HIT header'
    };
  }

  // SSR: Real content but no cache
  if (hasRealContent) {
    return {
      type: 'SSR',
      confidence: 'medium',
      reason: 'Full content but no cache header (dynamic SSR)'
    };
  }

  // Fallback
  return {
    type: 'UNKNOWN',
    confidence: 'low',
    reason: 'Unable to determine'
  };
}

// Main audit function
async function auditSite() {
  console.log('🔍 Starting WHP Codes Rendering Strategy Audit\n');

  try {
    // Discover URLs (crawl or sitemap mode)
    let urls;
    if (CRAWL_MODE) {
      urls = await crawlSite(START_URL, MAX_PAGES);
    } else {
      urls = await fetchSitemap(SITEMAP_URL);
    }
    const urlsToAudit = urls.slice(0, MAX_PAGES);

    console.log(`\n📊 Auditing ${urlsToAudit.length} pages...\n`);

    const results = [];
    const stats = {
      SSG: 0,
      SSR: 0,
      CSR: 0,
      UNKNOWN: 0,
      errors: 0
    };

    // Process each URL
    for (let i = 0; i < urlsToAudit.length; i++) {
      const url = urlsToAudit[i];
      const progress = `[${i + 1}/${urlsToAudit.length}]`;

      try {
        process.stdout.write(`${progress} ${url.substring(0, 60)}...`);

        const { html, headers, statusCode } = await fetchURL(url);
        const analysis = analyzeHTML(html, headers, url, statusCode);
        let classification = classifyPage(analysis);

        // Double-fetch probe for ISR detection (warm cache)
        if (DOUBLE_FETCH_ISR && classification.type === 'SSR') {
          await new Promise(r => setTimeout(r, 300));
          const second = await fetchURL(url);
          const analysis2 = analyzeHTML(second.html, second.headers, url, second.statusCode);
          const hasCacheHit2 = /(hit|stale)/i.test(
            String(analysis2.cacheHeader) + ' ' + String(analysis2.cfCacheStatus)
          );

          if (hasCacheHit2) {
            classification = {
              type: 'SSG',
              confidence: 'medium',
              reason: 'Second fetch cache HIT/STALE (warm ISR)'
            };
          }
        }

        results.push({
          url,
          renderType: classification.type,
          confidence: classification.confidence,
          reason: classification.reason,
          hasFullText: analysis.hasTitle && analysis.hasDescription,
          cacheHeader: analysis.cacheHeader,
          cfCacheStatus: analysis.cfCacheStatus,
          contentLength: analysis.contentLength,
          nextDataSize: analysis.nextDataSize,
          notes: analysis.notes.join('; ')
        });

        stats[classification.type]++;
        console.log(` ✓ ${classification.type}`);

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(` ✗ ERROR: ${error.message}`);
        stats.errors++;
        results.push({
          url,
          renderType: 'ERROR',
          confidence: 'n/a',
          reason: error.message,
          hasFullText: false,
          cacheHeader: 'n/a',
          cfCacheStatus: 'n/a',
          contentLength: 0,
          nextDataSize: 0,
          notes: error.stack
        });
      }
    }

    // Calculate percentages
    const total = urlsToAudit.length - stats.errors;
    const percentages = {
      SSG: ((stats.SSG / total) * 100).toFixed(1),
      SSR: ((stats.SSR / total) * 100).toFixed(1),
      CSR: ((stats.CSR / total) * 100).toFixed(1),
      UNKNOWN: ((stats.UNKNOWN / total) * 100).toFixed(1)
    };

    // Print results
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('📊 RENDERING STRATEGY AUDIT RESULTS');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('┌──────────┬────────┬─────────────┐');
    console.log('│ Type     │ Count  │ % of total  │');
    console.log('├──────────┼────────┼─────────────┤');
    console.log(`│ SSG      │ ${String(stats.SSG).padStart(6)} │ ${String(percentages.SSG + '%').padStart(11)} │`);
    console.log(`│ SSR      │ ${String(stats.SSR).padStart(6)} │ ${String(percentages.SSR + '%').padStart(11)} │`);
    console.log(`│ CSR      │ ${String(stats.CSR).padStart(6)} │ ${String(percentages.CSR + '%').padStart(11)} │`);
    console.log(`│ UNKNOWN  │ ${String(stats.UNKNOWN).padStart(6)} │ ${String(percentages.UNKNOWN + '%').padStart(11)} │`);
    console.log('├──────────┼────────┼─────────────┤');
    console.log(`│ TOTAL    │ ${String(total).padStart(6)} │ 100.0%      │`);
    console.log('└──────────┴────────┴─────────────┘\n');

    if (stats.errors > 0) {
      console.log(`⚠️  ${stats.errors} pages had errors during fetch\n`);
    }

    // Flag CSR pages as SEO risks
    const csrPages = results.filter(r => r.renderType === 'CSR');
    if (csrPages.length > 0) {
      console.log('🚨 HIGH SEO RISK: Client-Side Rendered Pages\n');
      console.log('These pages may not be visible to search engines:\n');
      csrPages.slice(0, 10).forEach((page, i) => {
        console.log(`${i + 1}. ${page.url}`);
        console.log(`   Reason: ${page.reason}\n`);
      });
      if (csrPages.length > 10) {
        console.log(`   ... and ${csrPages.length - 10} more CSR pages\n`);
      }
    }

    // Write CSV
    const csvRows = [
      'URL,Render Type,Confidence,Has Full Text,Cache Header,CF Cache,Content Length,Next Data Size,Reason,Notes'
    ];

    results.forEach(r => {
      csvRows.push([
        `"${r.url}"`,
        r.renderType,
        r.confidence,
        r.hasFullText,
        r.cacheHeader,
        r.cfCacheStatus,
        r.contentLength,
        r.nextDataSize,
        `"${r.reason}"`,
        `"${r.notes}"`
      ].join(','));
    });

    await fs.writeFile(OUTPUT_CSV, csvRows.join('\n'));
    console.log(`✅ Detailed results saved to: ${OUTPUT_CSV}\n`);

    // Summary recommendations
    console.log('═══════════════════════════════════════════════════');
    console.log('💡 RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════\n');

    if (percentages.SSG >= 70) {
      console.log('✅ GOOD: ' + percentages.SSG + '% of pages are statically generated');
    } else {
      console.log('⚠️  ATTENTION: Only ' + percentages.SSG + '% SSG - consider increasing static generation');
    }

    if (percentages.CSR > 5) {
      console.log('🚨 CRITICAL: ' + percentages.CSR + '% CSR pages need conversion to SSR/SSG for SEO');
    } else {
      console.log('✅ GOOD: Low CSR usage (' + percentages.CSR + '%)');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run audit
auditSite().catch(console.error);
