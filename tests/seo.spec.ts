import { test, expect } from '@playwright/test';

// Sample URLs for testing different SEO states
const RETIRED_SLUG = 'crown-legacy-investments';
const NOINDEX_SLUG = 'kiva-services';
const INDEX_SLUG = 'ayecon-academy-monthly-mentorship';

test.describe('SEO Guardrails - Critical Status & Robots Validation', () => {
  
  test('retired page returns 410 Gone', async ({ request }) => {
    const res = await request.get(`/en/whop/${RETIRED_SLUG}`);
    // 410 via middleware is ideal; 404 fallback is acceptable
    expect([410, 404]).toContain(res.status());
    
    // If 410, should have cache headers
    if (res.status() === 410) {
      const cacheControl = res.headers()['cache-control'];
      expect(cacheControl).toContain('max-age=300');
    }
  });

  test('noindex page has X-Robots-Tag header + meta robots', async ({ page }) => {
    const res = await page.goto(`/en/whop/${NOINDEX_SLUG}`);
    expect(res?.status()).toBe(200);
    
    // Belt-and-braces: Both header AND meta should be present
    const headers = res?.headers() || {};
    expect(headers['x-robots-tag']).toContain('noindex');
    
    // Check meta robots tag exists and contains noindex
    const metaRobots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(metaRobots?.toLowerCase()).toContain('noindex');
    expect(metaRobots?.toLowerCase()).toContain('follow'); // Should still allow following
  });

  test('index page has no noindex signals', async ({ page }) => {
    const res = await page.goto(`/en/whop/${INDEX_SLUG}`);
    expect(res?.status()).toBe(200);
    
    // Should NOT have X-Robots-Tag header
    const headers = res?.headers() || {};
    expect(headers['x-robots-tag'] || '').toBe('');
    
    // Meta robots should allow indexing
    const metaRobots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(metaRobots?.toLowerCase()).toContain('index');
    expect(metaRobots?.toLowerCase()).toContain('follow');
  });

  test('sitemaps exclude retired content', async ({ request }) => {
    // Main sitemap should only contain indexable content
    const mainSitemap = await request.get('/sitemap.xml');
    expect(mainSitemap.status()).toBe(200);
    const mainContent = await mainSitemap.text();
    
    // Should NOT contain retired URLs
    expect(mainContent).not.toContain(RETIRED_SLUG);
    
    // Should contain indexable URLs
    expect(mainContent).toContain(INDEX_SLUG);
  });

  test('deindex sitemap contains only noindex content', async ({ request }) => {
    const deindexSitemap = await request.get('/deindex-sitemap');
    expect(deindexSitemap.status()).toBe(200);
    const deindexContent = await deindexSitemap.text();
    
    // Should contain noindex URLs
    expect(deindexContent).toContain(NOINDEX_SLUG);
    
    // Should NOT contain indexable or retired URLs
    expect(deindexContent).not.toContain(INDEX_SLUG);
    expect(deindexContent).not.toContain(RETIRED_SLUG);
  });

});