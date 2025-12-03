# Rebrand - Phase 1: Legacy Brand Audit

This is the canonical checklist for removing all legacy brand/domain traces from the codebase.
Generated: 2025-12-03

**Old Brand:** WHPCodes / WHP Codes / whpcodes.com
**Old Route Structure:** `/whop/[slug]`

---

## Phase 2 – Naming & Structure Plan

### Naming Scheme
- Route segment: `/whop/[slug]` → `/offer/[slug]`
- Component prefix: `Whop` → `Offer`
  - `WhopCard` → `OfferCard`
  - `RecommendedWhops` → `RecommendedOffers`
- Component directory: `src/components/whop/` → `src/components/offer/`
- Data/types:
  - `src/data/whops.ts` → `src/data/offers.ts`
  - `src/types/whop.ts` → `src/types/offer.ts`
- Scripts: `*-whop*.mjs/ts` → `*-offer*.mjs/ts`

### Files to Rename (Phase 2) - COMPLETED 2025-12-03

#### Routes
- [x] `src/app/(public)/whop/[slug]/` → `src/app/(public)/offer/[slug]/`
- [x] `src/app/(public)/whop/__probe/route.ts` → `src/app/(public)/offer/__probe/route.ts`
- [x] `src/app/api/debug-api/whop/[slug]/route.ts` → `src/app/api/debug-api/offer/[slug]/route.ts`

#### Components
- [x] `src/components/WhopCard.tsx` → `src/components/OfferCard.tsx`
- [x] `src/components/WhopCardLink.tsx` → `src/components/OfferCardLink.tsx`
- [x] `src/components/RecommendedWhops.tsx` → `src/components/RecommendedOffers.tsx`
- [x] `src/components/RecommendedWhopsServer.tsx` → `src/components/RecommendedOffersServer.tsx`
- [x] `src/components/RecommendedWhopsServerHTML.ts` → `src/components/RecommendedOffersServerHTML.ts`
- [x] `src/components/VirtualizedWhopList.tsx` → `src/components/VirtualizedOfferList.tsx`
- [x] `src/components/_ServerWhopCard.tsx` → `src/components/_ServerOfferCard.tsx`
- [x] `src/components/whop/` → `src/components/offer/`

#### Data Layer
- [x] `src/data/whops.ts` → `src/data/offers.ts`
- [x] `src/types/whop.ts` → `src/types/offer.ts`

#### Scripts (selected high-priority)
- [ ] `scripts/generate-whop-content.mjs` → `scripts/generate-offer-content.mjs` (deferred - low priority)

**Note:** Prisma model `Whop` and DB schema remain unchanged - internal naming only.

#### Additional Phase 2 Changes
- [x] Updated `middleware.ts` with `/offer/` route handling and 301 redirect from `/whop/`
- [x] Updated `src/lib/urls.ts` with `offerAbsoluteUrl` function + legacy alias
- [x] Updated `src/lib/paths.ts` with `offerHref` function + legacy alias
- [x] Updated `src/data/promo-stats.ts` to support both `/offer/` and `/whop/` paths for historical data
- [x] Fixed all import paths throughout codebase
- [x] Build passes with `npm run build`
- [x] Lint passes with `npm run lint`

---

## Routes & Folders

### Main Product Route
- [ ] `/src/app/(public)/whop/[slug]/page.tsx` - Route segment and internal references
- [ ] `/src/app/(public)/whop/[slug]/layout.tsx` - Layout component
- [ ] `/src/app/(public)/whop/[slug]/loading.tsx` - Loading state
- [ ] `/src/app/(public)/whop/[slug]/error.tsx` - Error boundary
- [ ] `/src/app/(public)/whop/[slug]/vm.ts` - View model
- [ ] `/src/app/(public)/whop/[slug]/@types/page.tsx` - Parallel route
- [ ] `/src/app/(public)/whop/[slug]/@types/default.tsx` - Parallel route default
- [ ] `/src/app/(public)/whop/[slug]/@etypes/page.tsx` - Parallel route
- [ ] `/src/app/(public)/whop/[slug]/@etypes/default.tsx` - Parallel route default
- [ ] `/src/app/(public)/whop/__probe/route.ts` - Probe endpoint

### API Routes
- [ ] `/src/app/api/debug-api/whop/[slug]/route.ts` - Debug API route

---

## Components

### Main Components (Rename Required)
- [ ] `/src/components/WhopCard.tsx` - Main card component
- [ ] `/src/components/WhopCardLink.tsx` - Card link wrapper
- [ ] `/src/components/RecommendedWhops.tsx` - Recommendations client
- [ ] `/src/components/RecommendedWhopsServer.tsx` - Recommendations server
- [ ] `/src/components/RecommendedWhopsServerHTML.ts` - HTML template
- [ ] `/src/components/VirtualizedWhopList.tsx` - Virtualized list
- [ ] `/src/components/_ServerWhopCard.tsx` - Server card component

### Whop Components Directory
- [ ] `/src/components/whop/HowToSchema.tsx` - Schema component
- [ ] `/src/components/whop/HowToSection.tsx` - How-to section
- [ ] `/src/components/whop/WhopDomInit.tsx` - DOM initialization
- [ ] `/src/components/whop/cardStyles.ts` - Card styles

### Components Using Whop References (Internal Updates)
- [ ] `/src/components/HomePage.tsx` - Home page (title references)
- [ ] `/src/components/HomePageServer.tsx` - Server home page
- [ ] `/src/components/Alternatives.tsx` - Alternatives component
- [ ] `/src/components/FAQSectionServer.tsx` - FAQ section

---

## Styles / ClassNames

- [ ] Check for `.whop-card` or similar class names in all components
- [ ] Check Tailwind classes for any "whop" references
- [ ] `/src/components/whop/cardStyles.ts` - Card style definitions

---

## Metadata & JSON-LD

### i18n Translations (All Locales)
- [ ] `/src/lib/i18n.ts` - All `home.title`, descriptions, brand references in:
  - `en` (lines ~27-150)
  - `es` (lines ~184-300)
  - `nl` (lines ~341-450)
  - `fr` (lines ~498-610)
  - `de` (lines ~655-770)
  - `it` (lines ~812-925)
  - `pt` (lines ~969-1080)
  - `zh` (lines ~1126+)

### Page Metadata
- [ ] `/src/app/(public)/page.tsx` - Home page JSON-LD (WebSite, Organization)
- [ ] `/src/app/(public)/layout.tsx` - Root layout metadata
- [ ] `/src/app/(public)/about/page.tsx` - About page schema
- [ ] `/src/app/(public)/contact/page.tsx` - Contact page schema
- [ ] `/src/app/(public)/terms/page.tsx` - Terms page schema
- [ ] `/src/app/(public)/privacy/page.tsx` - Privacy page schema
- [ ] `/src/app/(public)/blog/page.tsx` - Blog index metadata
- [ ] `/src/app/(public)/blog/[slug]/page.tsx` - Blog post metadata & Organization schema

### JSON-LD Components
- [ ] `/src/components/JsonLd.tsx` - JSON-LD component
- [ ] `/src/lib/blog-utils.ts` - Blog article schema (@id values)
- [ ] `/src/lib/seo-classification.ts` - SEO classification logic

### Canonical URLs (Currently Commented)
- [ ] `/src/app/(public)/page.tsx:201` - Home canonical (commented: PHASE1-DEINDEX)
- [ ] `/src/app/(public)/blog/page.tsx:26` - Blog canonical (commented: PHASE1-DEINDEX)
- [ ] `/src/app/(public)/whop/[slug]/page.tsx:398` - Product canonical (commented: PHASE1-DEINDEX)

---

## Environment Variables

### Files to Update
- [ ] `.env.example` - `SITE_ORIGIN=https://whpcodes.com`
- [ ] `.env` - Check for hardcoded domain
- [ ] `.env.local` - Check for hardcoded domain
- [ ] `.env.prod` - Check for hardcoded domain

### Code References
- [ ] `/src/lib/urls.ts:5` - `ORIGIN` fallback to whpcodes.com
- [ ] `/next.config.cjs:8` - `ASSET_ORIGIN` fallback
- [ ] `/next.config.cjs:18` - `hostname: 'whpcodes.com'`

---

## Public Assets

### Sitemaps (Old Backups - Can Delete)
- [ ] `public/sitemap-index.xml.backup`
- [ ] `public/sitemap-static.xml.backup`
- [ ] `public/sitemap-whops-1.xml.backup` through `sitemap-whops-9.xml.backup`

### Current Sitemaps (Need URL Updates)
- [ ] `public/sitemaps/static.xml` - Contains whpcodes.com URLs
- [ ] `public/sitemaps/blog.xml` - Contains whpcodes.com URLs
- [ ] `public/sitemaps/index-1.xml` - Contains whpcodes.com URLs
- [ ] `public/sitemaps/noindex.xml` - Contains whpcodes.com URLs

### Images
- [ ] `public/images/howto/whop-ui-map-2025-09.webp` - Screenshot with "whop" name
- [ ] `public/images/howto/whop-ui-map-2025-09.png` - Screenshot with "whop" name
- [ ] `public/images/:images:howto:whop-ui-map-2025-09.webp` - Malformed path

### Favicon/Logo (Review for Brand)
- [ ] `public/favicon.ico`
- [ ] `public/favicon.png`
- [ ] `public/favicon.svg`
- [ ] `public/logo.png`
- [ ] `public/apple-touch-icon.png`
- [ ] `public/android-chrome-*.png`
- [ ] `public/site.webmanifest` - Check for brand name

---

## Data Layer & Types

### Data Fetching
- [ ] `/src/data/whops.ts` - File name and all `whop` variable names
- [ ] `/src/data/promo-stats.ts` - `whop` references, path matching
- [ ] `/src/data/recommendations.ts` - `whop` variable names
- [ ] `/src/data/statistics.ts` - `whop` references

### Types
- [ ] `/src/types/whop.ts` - File name and type definitions

### Cache Tags
- [ ] `/src/lib/cacheTags.ts` - `tagForWhop` function name

### Image Utils
- [ ] `/src/lib/whopImage.ts` - File name

---

## Scripts (Phase 2+ - Rename/Update)

### Content Generation
- [ ] `scripts/generate-whop-content.mjs` - Main content script
- [ ] `scripts/generate-whop-content.mjs.backup-before-max-retries-fix`

### Data Management
- [ ] `scripts/import-whops.ts`
- [ ] `scripts/export-whops.ts`
- [ ] `scripts/categorize-all-whops.ts`
- [ ] `scripts/categorize-all-whops-holistic.ts`
- [ ] `scripts/analyze-whop-categories.ts`
- [ ] `scripts/manual-publish-whops.ts`
- [ ] `scripts/publish-custom-whops.ts`
- [ ] `scripts/republish-all-whops-batched.ts`
- [ ] `scripts/check-whop-status.ts`
- [ ] `scripts/add-promo-codes-to-whops.ts`
- [ ] `scripts/whop-publication-monitor.ts`
- [ ] `scripts/auto-check-whops.mjs`
- [ ] `scripts/warm-top-whops.mjs`
- [ ] `scripts/monitor-whop-progress.mjs`
- [ ] `scripts/query-promo-whops.mjs`
- [ ] `scripts/query-whops-needing-content.mjs`
- [ ] `scripts/run-all-whops.mjs`
- [ ] `scripts/upsert-whop-content.mjs`
- [ ] `scripts/recategorize-other-whops.js`
- [ ] `scripts/import-whops-with-correct-affiliate.js`
- [ ] `scripts/update-whop-affiliate-links.js`

---

## Email Templates

- [ ] `/src/lib/gmail-oauth.ts:79` - "WHPCodes contact form"
- [ ] `/src/lib/gmail-oauth.ts:109` - Subject line "Thank you for contacting WHPCodes"
- [ ] `/src/lib/gmail-oauth.ts:113-139` - Email body references

---

## Documentation

- [ ] `README.md` - Brand references
- [ ] `GMAIL_OAUTH_SETUP.md` - "WHPCodes Email" references
- [ ] `docs/static-plan.md` - Canonical URL examples
- [ ] `docs/static-verification.md` - Brand/URL examples
- [ ] `SCHEMA-LOCALE-ACTIVATION.md` - @id URL examples
- [ ] `AFFILIATE_LINKS_GUIDE.md` - References

---

## Auth/Security

- [x] `check-jwt-token.js:4` - JWT secret renamed to neutral "site-dev-secret-key" with TODO comment
- [x] `check-jwt-token.js:14` - Cookie domain reference updated to "[your-domain]"

---

## Backup/Legacy Files (Safe to Delete)

**COMPLETED:** All 127 `.bak` files moved to `archive/legacy-backups/` directory on 2025-12-03.

- [x] All `*.bak` files from root directory
- [x] All `*.bak` files from `scripts/` directory
- [x] All `*.bak` files from `data/pages/` directory
- [x] All `*.bak` files from `golden-scripts/` directory
- [x] Old sitemap backups (`public/sitemap-*.xml.backup`)

---

## Data Export Files (Review/Delete)

- [ ] `whops-export.json`
- [ ] `whops_backup.csv`
- [ ] `sample-whops.csv`
- [ ] `sample-whops-with-price.csv`
- [ ] `whop fianl 2 jun.csv`
- [ ] `whop fianl 2 jun.numbers`
- [ ] `whop_data_backup.sql`
- [ ] `data/neon/whops.json`
- [ ] `data/neon/whops.jsonl`
- [ ] `data/promo-whop-slugs.txt`
- [ ] `data/promo-whop-slugs-comma.txt`
- [ ] `exports/whop-content-*.csv`

---

## Database Schema (Special Handling Required)

**Note:** The Prisma schema model `Whop` cannot be renamed without a database migration.
The model name itself is NOT exposed to Google - only the URL route matters.

### Items in Schema
- [ ] `model Whop` - Main model (internal name, low priority)
- [ ] `enum WhopCategory` - Category enum (internal name, low priority)
- [ ] `whopId` fields in related models - Foreign key references
- [ ] `whopCategory` field - Uses the enum

**Recommendation:** Keep internal database names as-is; focus on URL/metadata renaming.

---

## Root Level Misc Files

- [ ] `split-sitemap.js:7` - Old sitemap URL
- [ ] `sync-production-blog.js` - "WHP Codes" brand references
- [ ] `find-vip-content.js` - WHPCodes reference check
- [ ] `check-blog-posts.js` - WHPCodes reference check
- [ ] Various `find-*-whops.ts` files in root

---

## Email Templates

- [x] `src/lib/gmail-oauth.ts:79` - Changed "WHPCodes contact form" to neutral "our website contact form"
- [x] `src/lib/gmail-oauth.ts:109` - Changed subject from "Thank you for contacting WHPCodes" to "Thank you for contacting us"
- [x] `src/lib/gmail-oauth.ts:113` - Changed heading from "Thank you for contacting WHPCodes" to "Thank you for contacting us"
- [x] `src/lib/gmail-oauth.ts:136-140` - Removed old domain URLs, changed "The WHPCodes Team" to "Our Team"
- [ ] `src/lib/gmail-oauth.ts:37,57,107` - Email addresses still `whpcodes@gmail.com` (requires new email setup - deferred to env phase)

**Note:** Added TODO comments in gmail-oauth.ts for final brand/domain update once new domain is finalized.

---

## Progress Tracking

**Phase 1 Status:** COMPLETE (2025-12-03)
**Phase 2 (Route + Component Renaming):** COMPLETE (2025-12-03)
**Phase 3 (Metadata + JSON-LD):** NOT STARTED
**Phase 4 (Visual Rebrand):** NOT STARTED

---

## Notes

1. All canonical URLs are currently commented out with `// PHASE1-DEINDEX:` prefix - this is intentional for the old domain deindexing
2. No Google verification HTML files found - already removed
3. Database model names are internal and do not affect SEO
4. Focus renaming efforts on: routes, components, metadata, and user-facing content

---

## Phase 1 Audit Script Results (2025-12-03)

Audit script (`npm run audit:legacy-brand`) scanned 605 source files and found:

| Pattern | Matches | Priority |
|---------|---------|----------|
| whpcodes.com domain | 10,789 | HIGH - Mostly in XML sitemaps (will regenerate) |
| WHPCodes brand | 172 | HIGH - i18n, email templates, docs |
| WHP Codes brand | 14 | HIGH - Blog pages, sync scripts |
| /whop/ route | 26,994 | PHASE 2 - Mostly sitemaps, some code |
| WhopCard component | 28 | PHASE 2 - Component files |
| RecommendedWhops component | 11 | PHASE 2 - Component files |
| whopId variable | 285 | PHASE 2 - Data layer (internal) |
| Whop Promo Codes tagline | 77 | PHASE 3 - Metadata/titles |

**Note:** Audit excludes `data/`, `exports/`, JSON/CSV files - those need separate content migration review.

---

## Phase 1 Clean-ups Applied

1. **Backup files archived:** 127 `.bak` files moved to `archive/legacy-backups/`
2. **Old sitemap backups archived:** `public/sitemap-*.xml.backup` files moved
3. **Email templates neutralized:** `src/lib/gmail-oauth.ts` brand references replaced with neutral text + TODOs
4. **JWT debug script updated:** `check-jwt-token.js` secret and domain references neutralized
5. **Guardrail script created:** `npm run audit:legacy-brand` for ongoing monitoring

---

## Deferred Items (For Later Phases)

- `whpcodes@gmail.com` email addresses - requires new email account setup (env phase)
- `src/lib/urls.ts:5` - ORIGIN fallback to whpcodes.com (env phase)
- `next.config.cjs:8,18` - ASSET_ORIGIN and hostname (env phase)
- `.env.example` - SITE_ORIGIN default (env phase)
- All `/whop/` route references (Phase 2)
- All component renames (Phase 2)
- All i18n/metadata rewrites (Phase 3)
- JSON-LD schema updates (Phase 3)
