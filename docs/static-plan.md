# Static-First Architecture: Route Inventory & Classification

**Project:** WHP Codes - SSG/ISR Migration for Maximum SEO & Googlebot Crawlability
**Date Created:** October 2, 2025
**Purpose:** Convert site from CSR to static-first (SSG + ISR) to ship full HTML at response time for search engines

---

## Route Classification Summary

| Category | Route Count | Rendering Strategy | Indexing Status |
|----------|-------------|-------------------|-----------------|
| **SEO-Critical (SSG/ISR)** | ~8,800+ | Static-first with ISR | `index,follow` |
| **Dynamic User Pages** | 20+ | SSR/CSR | `noindex,follow` |
| **Static Content** | 7 | SSG | `index,follow` |

---

## A. SEO-CRITICAL ROUTES (SSG + ISR) - INDEXABLE

These routes MUST ship full HTML at response time with all content, internal links, and JSON-LD visible in server HTML.

| Route | Current Mode | Dynamic Dependencies | Target Mode | Actions Required |
|-------|--------------|---------------------|-------------|------------------|
| `/` (Home) | **CSR** (`use client`) | `useRouter`, `useState`, `useEffect`, client fetch | **SSG + ISR (24h)** | • Remove `use client`<br>• Fetch whops in server component<br>• Remove client state mgmt<br>• Move JSON-LD to server HTML<br>• Render links as `<a>` tags<br>• Add route exports |
| `/whop/[slug]` | **Dynamic** (`force-dynamic` when LOG_SCHEMA=1)<br>**ISR** (3600s revalidate) when flag off | `headers()` (L10, L84-86)<br>`unstable_noStore()` (L207)<br>API fetch for deals | **SSG + ISR (24h)** | • Remove `headers()` dependency<br>• Remove `unstable_noStore()`<br>• Remove LOG_SCHEMA toggle<br>• Set `dynamic='force-static'`<br>• Implement `generateStaticParams` for top 800 pages<br>• Add cache tags for revalidation<br>• Already has JSON-LD (good!) |
| `/blog` | **Dynamic** (`force-dynamic`) | Direct DB fetch | **SSG + ISR (1h)** | • Change to `force-static`<br>• Set `revalidate = 3600`<br>• Add `fetchCache = 'force-cache'`<br>• Keep server component (good!)<br>• Ensure links are `<a>` tags |
| `/blog/[slug]` | **Dynamic** (`force-dynamic`) | Direct DB fetch | **SSG + ISR (1h)** | • Change to `force-static`<br>• Add `generateStaticParams` for all published posts<br>• Set `revalidate = 3600`<br>• Add `fetchCache = 'force-cache'`<br>• Already has JSON-LD (good!) |
| `/about` | SSR | None identified | **SSG** | • Add `dynamic='force-static'`<br>• Add `fetchCache = 'force-cache'`<br>• Ensure no request-bound APIs |
| `/contact` | SSR | Form submission (client) | **SSG** | • Static page, dynamic form OK<br>• Add `dynamic='force-static'`<br>• Add `fetchCache = 'force-cache'` |
| `/privacy` | SSR | None | **SSG** | • Add `dynamic='force-static'`<br>• Add `fetchCache = 'force-cache'` |
| `/terms` | SSR | None | **SSG** | • Add `dynamic='force-static'`<br>• Add `fetchCache = 'force-cache'` |

**Key Issues to Fix:**

1. **Home page (`/`)**: Currently fully client-rendered with gray shell on JS-off. Must become server component with SSG + ISR.
2. **Whop pages**: Uses `headers()` and `unstable_noStore()` which force dynamic rendering - must remove these. Remove LOG_SCHEMA env-based toggle entirely.
3. **Blog pages**: Currently `force-dynamic` - should be static with ISR and `generateStaticParams()`.

---

## B. DYNAMIC USER ROUTES (SSR/CSR) - NOINDEX

These routes serve user-specific or query-driven content and should NOT be indexed.

| Route | Current Mode | Purpose | Target Mode | Actions Required |
|-------|--------------|---------|-------------|------------------|
| `/admin/*` (all) | CSR | Admin dashboard | **SSR/CSR** | • Add `dynamic='force-dynamic'`<br>• Add robots metadata to layout |
| `/admin/login` | CSR | Authentication | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/whops` | CSR | Whop management | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/whops/[id]` | CSR | Whop editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/whops/[id]/content` | CSR | Content editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/blog` | CSR | Blog management | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/blog/[id]/edit` | CSR | Blog editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/blog/new` | CSR | Blog creation | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/reviews` | CSR | Review management | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/reviews/[id]` | CSR | Review editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/comments` | CSR | Comment moderation | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/users` | CSR | User management | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/users/[id]` | CSR | User editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/casinos` | CSR | Casino management | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/casinos/[id]` | CSR | Casino editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/casinos/[id]/content` | CSR | Casino content | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/casinos/new` | CSR | Casino creation | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/bonuses/[id]` | CSR | Bonus editing | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/pages` | CSR | Page management | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/analytics` | CSR | Analytics dashboard | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/settings` | CSR | Site settings | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/enquiries` | CSR | Contact enquiries | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/mailing-list` | CSR | Email list mgmt | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/promo-submissions` | CSR | User submissions | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/admin/publishing` | CSR | Publishing tools | **SSR/CSR** | • Keep dynamic<br>• Inherit noindex from layout |
| `/submit-code` | SSR/CSR | User code submission | **SSR/CSR** | • Add noindex<br>• Keep dynamic form |
| `/subscribe` | SSR/CSR | Email subscription | **SSR/CSR** | • Add noindex<br>• Keep dynamic form |
| `/unsubscribe` | SSR/CSR | Email unsubscribe | **SSR/CSR** | • Add noindex<br>• Keep dynamic form |

**Actions Required:**

```typescript
// app/(private)/layout.tsx
export const metadata = {
  robots: { index: false, follow: true, nocache: true },
}
```

- Add `noindex,follow,nocache` metadata to admin layout (all children inherit)
- Add `noindex,follow` to form submission pages
- Ensure `dynamic='force-dynamic'` on all admin routes
- Exclude all admin routes and search/filter pages from sitemaps

---

## C. ROUTE-LEVEL CONFIGURATION DETAILS

### SSG/ISR Routes Configuration

**Standard configuration for all SEO-critical pages:**

```typescript
// Home page
export const dynamic = 'force-static'
export const revalidate = 86400  // 24 hours
export const fetchCache = 'force-cache'

// Whop detail pages
export const dynamic = 'force-static'
export const revalidate = 86400  // 24 hours
export const dynamicParams = true  // Enable ISR for non-prebuilt pages
export const fetchCache = 'force-cache'

// Blog list page
export const dynamic = 'force-static'
export const revalidate = 3600   // 1 hour
export const fetchCache = 'force-cache'

// Blog detail pages
export const dynamic = 'force-static'
export const revalidate = 3600   // 1 hour
export const dynamicParams = true
export const fetchCache = 'force-cache'

// Static content pages (About, Contact, Privacy, Terms)
export const dynamic = 'force-static'
export const fetchCache = 'force-cache'
```

### Dynamic Routes Configuration

```typescript
// Admin & user-driven pages
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  robots: { index: false, follow: true, nocache: true }
}
```

---

## D. STATIC PARAM GENERATION STRATEGY

### Whop Pages (`/whop/[slug]`)

**Strategy:** Prebuild top ~800 "money pages", use ISR for long tail

```typescript
export async function generateStaticParams() {
  // Prebuild curated/indexed subset
  const rows = await prisma.whop.findMany({
    where: {
      indexingStatus: 'INDEXED',  // Only quality pages
      retirement: { not: 'GONE' }  // Exclude retired pages
    },
    select: { slug: true },
    orderBy: { displayOrder: 'asc' },
    take: 800  // Budget for top pages
  })

  return rows.map(r => ({ slug: r.slug }))
}
```

### Blog Posts (`/blog/[slug]`)

**Strategy:** Prebuild all published posts (smaller dataset)

```typescript
export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true }
  })

  return posts.map(p => ({ slug: p.slug }))
}
```

---

## E. CRITICAL FIXES REQUIRED

### 1. Home Page - Client to Server Migration

**Current Issues:**
- Entire page is `'use client'`
- Data fetched in `useEffect` client-side
- JSON-LD in `<Script>` component (client)
- Navigation state management prevents SSG

**Required Changes:**
```typescript
// Remove 'use client'
export const dynamic = 'force-static'
export const revalidate = 86400
export const fetchCache = 'force-cache'

// Fetch data server-side
async function getData() {
  const whops = await prisma.whop.findMany({
    where: { /* filter */ },
    take: 15,
    include: { PromoCode: true }
  })

  const stats = await prisma.user.count()

  return { whops, stats }
}

export default async function Home() {
  const data = await getData()

  return (
    <main>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      {/* Server-rendered content with links as <a> tags */}
      <HomePage initialData={data} /> {/* Client island for interactivity */}
    </main>
  )
}
```

**Appearance parity rule:** If a section must stay as a client island for UX, pre-render a server HTML summary above it with the same content.

### 2. Whop Pages - Remove Dynamic Dependencies

**Current Issues:**
- `headers()` used for base URL resolution (L10, L84-86)
- `unstable_noStore()` forces dynamic (L207)
- Conditional `force-dynamic` based on LOG_SCHEMA env var (L13) - **DELETE THIS**

**Required Changes:**
```typescript
// Remove headers() dependency entirely
function resolveBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://whpcodes.com'
}

// Remove unstable_noStore() from generateMetadata
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  // unstable_noStore() removed - rely on route-level revalidate
  const whopData = await getWhopBySlug(params.slug, 'en')

  // generateMetadata() must set a stable canonical per slug
  // JSON-LD must render server-side in the page HTML
  return {
    // ...
    alternates: {
      canonical: `https://whpcodes.com/whop/${canonicalSlug}`
    }
  }
}

// DELETE the LOG_SCHEMA toggle entirely - always force-static
export const dynamic = 'force-static'
export const revalidate = 86400
export const fetchCache = 'force-cache'
```

**CRITICAL:** Ensure `headers()` and `unstable_noStore()` are not used anywhere in SEO page trees, including helpers imported into those pages.

### 3. Blog Pages - Add Static Generation

**Required Changes:**
```typescript
// app/(public)/blog/page.tsx
export const dynamic = 'force-static'
export const revalidate = 3600
export const fetchCache = 'force-cache'

// app/(public)/blog/[slug]/page.tsx
export const dynamic = 'force-static'
export const revalidate = 3600
export const dynamicParams = true
export const fetchCache = 'force-cache'

export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true }
  })

  return posts.map(p => ({ slug: p.slug }))
}
```

---

## F. QUALITY GATES FOR SITEMAP INCLUSION

Before including a Whop page in sitemap, it must pass ALL criteria:

✅ **Content Requirements:**
- Has meaningful aboutContent or description (≥350 words total across all content sections)
- Has howToRedeemContent or meaningful promo details (≥100 words)
- Has termsContent or fallback terms
- Has faqContent or 3+ structured FAQs

✅ **Promo Requirements:**
- At least 1 active promo code OR exclusive access deal
- Promo not expired (if date tracked)

✅ **Link Requirements:**
- 3+ internal links (related whops, alternatives, recommendations)
- Valid affiliate link or website URL

✅ **Schema Requirements:**
- Valid JSON-LD Product/Service schema
- BreadcrumbList present
- FAQ or HowTo schema if applicable

✅ **Technical Requirements:**
- `indexingStatus = 'INDEXED'`
- `retirement != 'GONE'`
- No redirect loops
- Passes JS-disabled HTML check

✅ **Deindexing Policy:**

For URLs removed from sitemaps, ensure one of the following:

- **301 redirect** → canonical hub (for duplicates)
- **410 Gone** (permanent removal for dead/irreparable pages)
- **noindex,follow** `<meta>` tag if page must stay live for UX but shouldn't be indexed (and remove all internal links to it)

---

## G. SITEMAP SHARDING STRATEGY

### Sitemap Index (`/sitemap.xml`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-blog.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-whops-a-f.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-whops-g-l.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-whops-m-r.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-whops-s-z.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://whpcodes.com/sitemap-whops-0-9.xml</loc>
  </sitemap>
</sitemapindex>
```

### Individual Sitemaps
- `sitemap-static.xml`: Home, About, Contact, Privacy, Terms
- `sitemap-blog.xml`: All published blog posts
- `sitemap-whops-[range].xml`: Whop pages by first letter (quality-gated)

### Sitemap lastmod
- Pull from `updatedAt` column in database
- Only update on material content changes (not click tracking or minor edits)
- Ensures truthful freshness signals to Googlebot

---

## H. CACHE TAGGING STRATEGY

### Tag Patterns
```typescript
// Whop pages
tags: [`whop:${slug}`, 'whop:all']

// Blog posts
tags: [`blog:${slug}`, 'blog:all']

// Home page
tags: ['home', 'whop:all']
```

### Revalidation API
```typescript
// app/api/revalidate/route.ts
export async function POST(req: Request) {
  const { secret, tag } = await req.json()

  if (secret !== process.env.REVALIDATE_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  revalidateTag(tag)
  return Response.json({ revalidated: true, tag })
}
```

### CI/Build Guards

**Enforce static-first architecture at build time:**

```typescript
// CI lint: Fail build if SEO pages use dynamic APIs
// Check: No files under app/(public)/**/page.tsx contain:
//   - "use client" at page level
//   - imports from "next/headers"
//   - unstable_noStore()

// CI build log: Print all routes not marked force-static
// During build, log any SEO route without dynamic='force-static'
```

**Implementation:**
- Add ESLint rule to detect `'use client'` in `app/(public)/**/page.tsx`
- Add custom Next.js build plugin to log dynamic routes
- Fail CI if any SEO page imports from `next/headers`

---

## I. MIGRATION TIMELINE

### Phase 1: Foundation (Week 1)
- [x] Create docs/static-plan.md (this document)
- [ ] Add route-level export configs to all pages
- [ ] Create revalidation API endpoint
- [ ] Set up cache tagging infrastructure
- [ ] Add CI lint guards for dynamic APIs

### Phase 2: Home & Whop Pages (Week 1-2)
- [ ] Convert home page from CSR to SSG + ISR
- [ ] Remove `headers()` and `unstable_noStore()` from whop pages
- [ ] Delete LOG_SCHEMA env-based toggle
- [ ] Implement `generateStaticParams` for whop pages
- [ ] Add route exports (dynamic, revalidate, fetchCache)
- [ ] Test with `npm run build` - verify static generation

### Phase 3: Blog & Static Pages (Week 2)
- [ ] Convert blog list page to SSG + ISR
- [ ] Convert blog detail pages to SSG + ISR
- [ ] Add `generateStaticParams` for blog posts
- [ ] Convert static pages (About, Contact, Privacy, Terms) to SSG
- [ ] Add route exports to all pages

### Phase 4: Admin & Dynamic Routes (Week 2)
- [ ] Add noindex metadata to admin layout
- [ ] Add noindex to form pages (submit-code, subscribe, unsubscribe)
- [ ] Verify no admin routes in sitemaps
- [ ] Test admin functionality still works

### Phase 5: Sitemaps & Quality Gates (Week 3)
- [ ] Implement quality gate logic
- [ ] Create sharded sitemaps
- [ ] Add truthful lastmod from DB updatedAt
- [ ] Test sitemap generation
- [ ] Verify deindexing policy (301/410/noindex)

### Phase 6: Testing & Verification (Week 3)
- [ ] JS-disabled browser test
- [ ] cURL HTML verification
- [ ] Cache hit verification
- [ ] Build output analysis
- [ ] GSC URL inspection test
- [ ] Create docs/static-verification.md

---

## J. SUCCESS METRICS

**Pre-Migration Baseline:**
- Home page: CSR (gray shell on JS-off)
- Whop pages: Mixed (some dynamic, some ISR with env flag)
- Blog pages: Dynamic SSR
- Build output: Mostly dynamic routes

**Post-Migration Target:**
- ✅ Home page: SSG with 24h ISR, full HTML on JS-off
- ✅ Whop pages: SSG (top 800) + ISR (long tail), 24h revalidate
- ✅ Blog pages: SSG (all published) + ISR, 1h revalidate
- ✅ Static pages: Pure SSG
- ✅ Admin pages: Dynamic with noindex (excluded from sitemaps)
- ✅ Build output: 800+ prerendered whop pages, all blog posts, static pages
- ✅ JS-off test: Full HTML with content, links, JSON-LD
- ✅ Cache headers: HIT on second request
- ✅ GSC: Faster crawl, more indexed pages
- ✅ No `headers()` or `unstable_noStore()` in SEO trees
- ✅ CI guards prevent regressions

---

**Next Steps:** Proceed to implementation phase B1 (Home page conversion to SSG + ISR)
