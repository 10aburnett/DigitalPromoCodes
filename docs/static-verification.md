# SSG/ISR Migration Verification Guide

**Status**: Phase A-C Complete (Checkpoint: development branch)
**Date**: 2025-10-02
**Purpose**: Verify static-first architecture and SEO optimizations

---

## 🎯 Quick Verification Checklist

### ✅ Build-Time Verification

```bash
# 1. Clean build
npm run build

# 2. Check route rendering modes
npm run build 2>&1 | grep -E "(Route \(app\)|○|●|λ)"

# Expected output:
# ○ /                    → SSG (24h ISR)
# ○ /about               → SSG (24h ISR)
# ○ /contact             → SSG (24h ISR)
# ○ /privacy             → SSG (24h ISR)
# ○ /terms               → SSG (24h ISR)
# ○ /blog                → SSG (1h ISR)
# ● /blog/[slug]         → SSG+ISR (prebuilt + dynamic)
# ○ /whop/[slug]         → SSG (24h ISR)
# ○ /robots.txt          → SSG
# ○ /sitemap.xml         → SSG
# ○ /blog/rss            → SSG
```

**Legend:**
- `○` = Static (SSG)
- `●` = SSG with getStaticProps (prebuilt paths)
- `λ` = Dynamic SSR (should NOT appear on SEO pages)

---

## 🔍 Runtime Verification

### 1. Robots & Crawlability

#### Test robots.txt
```bash
curl -s https://whpcodes.com/robots.txt
```

**Expected:**
```
User-agent: *
Allow: /
Disallow: /admin

Sitemap: https://whpcodes.com/sitemap.xml
Host: https://whpcodes.com
```

#### Test admin noindex header
```bash
curl -I https://whpcodes.com/admin
```

**Expected headers:**
```
HTTP/2 302
X-Robots-Tag: noindex, nofollow
Location: /admin/login
```

---

### 2. Sitemap & RSS

#### Test sitemap.xml
```bash
curl -s https://whpcodes.com/sitemap.xml | head -50
```

**Expected structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://whpcodes.com/</loc>
    <lastmod>2025-10-02T...</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1</priority>
  </url>
  <url>
    <loc>https://whpcodes.com/about</loc>
    ...
  </url>
  <!-- + blog posts + whop pages -->
</urlset>
```

**Verify includes:**
- Static pages: `/`, `/about`, `/contact`, `/privacy`, `/terms`
- Blog posts: All published posts at `/blog/[slug]`
- Whop pages: All INDEXED whops (not GONE) at `/whop/[slug]`

#### Test RSS feed
```bash
curl -s https://whpcodes.com/blog/rss | head -30
```

**Expected structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WHPCodes Blog</title>
    <link>https://whpcodes.com/blog</link>
    <description>Latest posts from WHPCodes</description>
    <item>
      <title><![CDATA[Post Title]]></title>
      <link>https://whpcodes.com/blog/post-slug</link>
      <guid>https://whpcodes.com/blog/post-slug</guid>
      <pubDate>Wed, 02 Oct 2025 12:00:00 GMT</pubDate>
      <description><![CDATA[Post excerpt]]></description>
    </item>
  </channel>
</rss>
```

**Validate:**
- ✅ Valid XML syntax
- ✅ Dates in RFC 2822 format
- ✅ Absolute URLs (not relative)
- ✅ CDATA wrapping for titles/descriptions

---

### 3. Structured Data (JSON-LD)

Test in [Google Rich Results Test](https://search.google.com/test/rich-results):

#### Home Page (/)
```bash
curl -s https://whpcodes.com/ | grep -A 20 'application/ld+json'
```

**Expected schemas:**
- `WebSite` (with siteNavigationElement)
- `Organization` (with logo, contactPoint)
- `ItemList` (top whop listings)

#### Blog List (/blog)
**Expected schemas:**
- `CollectionPage`
- Array of `BlogPosting` items

#### Blog Post (/blog/[slug])
**Expected schemas:**
- `BlogPosting` (with headline, datePublished, author)
- `BreadcrumbList`

#### About Page (/about)
**Expected schemas:**
- `Organization`

#### Contact Page (/contact)
**Expected schemas:**
- `ContactPage` (with mainEntity → Organization → contactPoint)

#### Privacy/Terms
**Expected schemas:**
- `WebPage`

#### Whop Detail (/whop/[slug])
**Expected schemas:**
- `Product` (with offers, aggregateRating)
- `BreadcrumbList`

---

### 4. Metadata & SEO Tags

#### Canonical URLs
```bash
curl -s https://whpcodes.com/about | grep canonical
```

**Expected:**
```html
<link rel="canonical" href="https://whpcodes.com/about"/>
```

**Verify all pages use `siteOrigin()` helper (not hardcoded domain)**

#### Robots Meta Tags
```bash
# SEO pages should be indexable
curl -s https://whpcodes.com/blog | grep robots

# Expected:
# <meta name="robots" content="index,follow"/>
```

#### OpenGraph Tags
```bash
curl -s https://whpcodes.com/about | grep 'og:'
```

**Expected:**
```html
<meta property="og:title" content="About WHPCodes..."/>
<meta property="og:description" content="..."/>
<meta property="og:url" content="https://whpcodes.com/about"/>
<meta property="og:type" content="website"/>
```

---

### 5. ISR Revalidation Intervals

Check route configs in source:

| Route | Revalidate | Purpose |
|-------|------------|---------|
| `/` | 86400 (24h) | Daily home page refresh |
| `/blog` | 3600 (1h) | Hourly blog list updates |
| `/blog/[slug]` | 3600 (1h) | Hourly post updates |
| `/whop/[slug]` | 86400 (24h) | Daily whop updates |
| `/about` | 86400 (24h) | Static content |
| `/contact` | 86400 (24h) | Static content |
| `/privacy` | 86400 (24h) | Legal content |
| `/terms` | 86400 (24h) | Legal content |

**Verify in build output:**
```bash
# Check .next/server/app directory
ls -la .next/server/app/(public)/
```

---

### 6. 404 UX Test

```bash
curl -s https://whpcodes.com/fake-page-that-does-not-exist | grep "Page Not Found"
```

**Expected:**
- ✅ Themed 404 page with site CSS variables
- ✅ Links to Home (`/`) and Blog (`/blog`)
- ✅ Search icon (🔍)
- ✅ User-friendly messaging

---

## 🧪 JavaScript-Off Test

Critical for verifying SSG/ISR is working correctly.

### Chrome DevTools Method
1. Open DevTools → Settings (⚙️)
2. Preferences → Debugger → "Disable JavaScript"
3. Visit test pages:
   - `/` → Should show full content, promo codes, filters (non-interactive)
   - `/blog` → Should show blog post grid
   - `/blog/[slug]` → Should show full post content + comments
   - `/whop/[slug]` → Should show product details, schema
   - `/about` → Should show full about content

**Pass criteria:**
- ✅ All text content visible
- ✅ Internal links clickable
- ✅ Images load with alt text
- ✅ JSON-LD scripts present in HTML
- ❌ Interactive features (filters, forms) won't work (expected)

---

## 📊 Performance Verification

### Lighthouse CI
```bash
# Test key pages
npx lighthouse https://whpcodes.com/ --view
npx lighthouse https://whpcodes.com/blog --view
npx lighthouse https://whpcodes.com/blog/[top-post-slug] --view
npx lighthouse https://whpcodes.com/whop/[top-whop-slug] --view
```

**Target scores:**
- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥95
- SEO: 100

**Watch for:**
- ⚠️ CLS (Cumulative Layout Shift) < 0.1
- ⚠️ LCP (Largest Contentful Paint) < 2.5s
- ⚠️ FID (First Input Delay) < 100ms

---

## 🔗 Internal Linking Verification

### Check About Page
```bash
curl -s https://whpcodes.com/about | grep -E 'href="/blog"|href="/contact"'
```

**Expected:**
- ✅ Link to `/blog`
- ✅ Link to `/contact`

### Check 404 Page
```bash
curl -s https://whpcodes.com/fake-url | grep -E 'href="/"|href="/blog"'
```

**Expected:**
- ✅ Link to `/` (Home)
- ✅ Link to `/blog`

---

## 🚨 Security & Privacy Checks

### Admin Route Protection
```bash
# Without auth cookie
curl -I https://whpcodes.com/admin

# Expected:
# - 302 redirect to /admin/login
# - X-Robots-Tag: noindex, nofollow
```

### Environment Variables
```bash
# Verify SITE_ORIGIN is set
echo $SITE_ORIGIN

# Expected (production):
# https://whpcodes.com
```

---

## 📈 Google Search Console Tests

### Submit Sitemap
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sitemaps → Add new sitemap: `https://whpcodes.com/sitemap.xml`
3. Wait 24-48 hours for indexing

### URL Inspection
Test these URLs:
- `https://whpcodes.com/`
- `https://whpcodes.com/blog`
- `https://whpcodes.com/blog/[recent-post]`
- `https://whpcodes.com/whop/[popular-whop]`

**Check for:**
- ✅ "URL is on Google"
- ✅ Canonical URL matches submitted URL
- ✅ Indexing allowed (not blocked by robots)
- ✅ Structured data detected

### Coverage Report
Monitor for:
- ❌ 4xx errors (should be minimal)
- ❌ 5xx errors (should be zero)
- ✅ Valid pages indexed
- ⚠️ Excluded pages (check reasons)

---

## 🐛 Common Issues & Fixes

### Issue: Routes showing as `λ` (dynamic) instead of `○` (static)

**Cause:** Using request-bound APIs like `headers()`, `cookies()`, `searchParams`

**Fix:**
1. Remove dynamic imports in page components
2. Use `siteOrigin()` instead of `headers()`
3. Add route config:
   ```ts
   export const dynamic = 'force-static'
   export const fetchCache = 'force-cache'
   ```

### Issue: Sitemap is empty or missing pages

**Cause:** Database query failing or indexingStatus filter too strict

**Fix:**
1. Check Prisma connection
2. Verify `indexingStatus: 'INDEXED'` and `retirement: { not: 'GONE' }` filters
3. Check blog posts have `published: true`

### Issue: RSS feed shows 404

**Cause:** Route file not in correct location

**Fix:**
- Ensure file is at `src/app/blog/rss/route.ts`
- Restart dev server: `npm run dev`

### Issue: Admin pages still showing in Google

**Cause:** X-Robots-Tag header not being applied

**Fix:**
1. Check middleware is running: `curl -I https://yourdomain/admin`
2. Verify middleware config matcher includes `/admin/:path*`
3. Submit URL removal request in Google Search Console

### Issue: Canonical URLs showing localhost

**Cause:** `SITE_ORIGIN` env var not set in production

**Fix:**
1. Add to `.env.local`: `SITE_ORIGIN=https://whpcodes.com`
2. Add to Vercel env vars (if using Vercel)
3. Rebuild: `npm run build`

---

## ✅ Sign-Off Checklist

Before merging to main:

- [ ] All routes compile as SSG (○) or SSG+ISR (●)
- [ ] robots.txt returns correct content
- [ ] sitemap.xml includes all expected URLs
- [ ] RSS feed is valid XML with absolute URLs
- [ ] JSON-LD schemas validate in Rich Results Test
- [ ] Canonical URLs use `siteOrigin()` helper
- [ ] Admin routes have noindex headers
- [ ] 404 page works and links internally
- [ ] JS-off test passes for SEO pages
- [ ] Lighthouse scores ≥90 for performance
- [ ] No console errors on key pages
- [ ] ISR revalidation intervals are correct
- [ ] Internal links present on static pages
- [ ] Build completes without errors

---

## 📝 Notes

### Remaining Work (Phase D-I)

**Not yet implemented:**
- D1: Cache tagging for Whop pages/hubs
- D2: On-demand revalidation API endpoint
- F: Sharded sitemaps (hubs, whops by alpha)
- G: Quality gates for sitemap inclusion
- H1: CI lint to prevent dynamic APIs in SEO pages
- H2: Build-time assertion for dynamic route detection

### Future Enhancements
- Default OG image generation via `@vercel/og`
- Category/hub pages with SSG
- Enhanced internal linking between related whops
- Blog post recommendations
- Search page with noindex directive

---

## 🎉 Success Metrics

After full deployment, monitor:

1. **Google Search Console**
   - Pages indexed ↑
   - Crawl budget efficiency ↑
   - Coverage errors ↓

2. **Analytics**
   - Organic search traffic ↑
   - Blog RSS subscribers ↑
   - 404 bounce rate ↓

3. **Performance**
   - TTFB (Time to First Byte) ↓
   - LCP (Largest Contentful Paint) ↓
   - CLS (Cumulative Layout Shift) ↓

4. **User Engagement**
   - Pages per session ↑
   - Avg session duration ↑
   - Internal link clicks ↑

---

**Last Updated**: 2025-10-02
**Verified By**: Claude Code
**Status**: ✅ Phase A-C Complete
