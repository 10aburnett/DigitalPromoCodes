# DigitalPromoCodes - Complete Rebrand Differentiation Checklist

> **Goal:** Launch DigitalPromoCodes as a completely new entity in Google's eyes, avoiding algorithmic suppression and duplicate detection from WHPCodes.

**Status:** IN PROGRESS
**Started:** 2024-12-03
**Last Updated:** 2024-12-03

---

## CRITICAL INSIGHT: Most Content Does NOT Need Rewriting

**Key Discovery:**
- Google only indexed a FEW HUNDRED pages from WHPCodes
- ~5,000+ pages were NOINDEX and Google NEVER saw them
- Those noindex pages are already FRESH and ORIGINAL

**Revised Strategy:**
- Full content rewrite ONLY for pages Google actually indexed (~200-400 pages)
- Layout/structure changes for ALL pages (breaks template similarity)
- Section heading rewrites for ALL pages
- Evidence image changes for ALL pages
- Metadata + JSON-LD regeneration for ALL pages

**This massively reduces workload while still achieving full differentiation.**

---

## Key Decisions Made

- **Writing Style:** Conversion-Optimised Tech-Editorial (authoritative, helpful, structured, persuasive)
- **Structure Approach:** Option A - Full structural reset (RECOMMENDED)
- **Visual Style:** PENDING - To be decided in Day E
- **Rewrite Scope:** Only indexed pages need full rewrite; others get layout/heading changes only

---

## Pre-Deployment Status

- [x] Repo renamed to DigitalPromoCodes
- [x] Git disconnected from old WHP Vercel project
- [x] Brand constants updated (SITE_BRAND, SITE_URL, etc.)
- [x] Prisma model renamed (Whop → Deal)
- [x] Middleware deindexing removed
- [x] Robots.txt restored to allow crawling
- [ ] **DO NOT DEPLOY until all steps below are complete**

---

## REVISED ORDER (Content First, Visual Last)

The order has been changed to prioritize content differentiation (Google's primary duplication detector) before visual changes.

---

## STEP 0 — Extract Indexed Pages from WHPCodes GSC (DO THIS FIRST)

> This determines which pages need full rewrites vs. layout-only changes

### 0.1 — Export from Google Search Console
- [ ] Go to GSC → WHPCodes property (https://whpcodes.com)
- [ ] Open Pages → "Indexed" tab
- [ ] Export → Download CSV
- [ ] Save as `whpcodes-indexed-pages.csv`

### 0.2 — Generate Analysis Files
- [ ] Parse CSV to extract all indexed slugs
- [ ] Create `indexed-slugs.json` (pages Google saw - NEED FULL REWRITE)
- [ ] Create `safe-slugs.json` (pages Google never saw - LAYOUT CHANGES ONLY)
- [ ] Create summary report with counts

### 0.3 — Expected Outcome
- ~200-400 pages in `indexed-slugs.json` (require full content rewrite)
- ~5,000+ pages in `safe-slugs.json` (keep content, change layout/headings/images only)

**STEP 0 STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY A — Content Rewrite Foundation (REDUCED SCOPE)

> **IMPORTANT:** Full rewrites ONLY for indexed pages from Step 0
> Non-indexed pages: Keep content, change layout/headings only

> Voice: Conversion-Optimised Tech-Editorial
> Tone: authoritative, helpful, slightly journalistic
> Style: structured, detailed, clear, persuasive

### A1 — Full Rewrite for INDEXED Pages Only (~200-400 pages)

These pages require complete content rewrites because Google saw them:

**MODULE 1 — About Section Rewrite**
- [ ] Create new template: opening contextual sentence
- [ ] Create new template: value proposition
- [ ] Create new template: what the tool/product does
- [ ] Create new template: why people use it
- [ ] Create new template: who it's for

**MODULE 2 — Promo Details Section Rewrite**
- [ ] Create bullet-driven benefits structure
- [ ] Create savings/access/features format
- [ ] Create new freshness phrase (NOT WHP style)
- [ ] Create trust language (verification process)

**MODULE 3 — How to Redeem Section Rewrite**
- [ ] Create new intro line template
- [ ] Create 5-6 steps with unique action verbs
- [ ] Ensure different phrasing from WHP

**MODULE 4 — Terms & Conditions Rewrite**
- [ ] Create 4-6 bullets template
- [ ] Generic platform requirements
- [ ] Expiry/availability disclaimers
- [ ] Usage restrictions (not copied from WHP)

**MODULE 5 — FAQ Rewrite Patterns**
- [ ] Create 4-6 FAQ templates
- [ ] Each Q fully rewritten
- [ ] Each A structured differently (longer, contextual, helpful)

### A2 — Automated Rewrite Script (for indexed pages only)
- [ ] Create Node.js/TypeScript script to:
  - Load slugs from `indexed-slugs.json`
  - Run content through rewrite engine
  - Produce fresh HTML for all content blocks
  - Save to new JSONL
  - Upsert into Prisma database

### A3 — Homepage & Category Rewrite (Google saw these)
- [ ] New homepage hero heading
- [ ] New homepage subheading
- [ ] New category intros for every category
- [ ] New trust badges (written content)
- [ ] New homepage explanatory paragraphs
- [ ] New homepage CTAs
- [ ] New breadcrumb wording
- [ ] New footer descriptions

### A4 — Static Pages Rewrite (Google saw these)
- [ ] Rewrite About page (completely new tone)
- [ ] Rewrite Contact page copy
- [ ] Rewrite Privacy Policy intro
- [ ] Rewrite Terms of Service intro

### A5 — Blog Content (Google saw these)
- [ ] Audit existing blog posts
- [ ] DELETE or COMPLETELY REWRITE each post
- [ ] New titles, headings, structure for any kept posts
- [ ] Update blog listing intro text

### A6 — Top-Level Text Rewrite (applies to all pages)
- [ ] Footer text
- [ ] Menu/nav labels
- [ ] Section headings (NEW heading text for ALL pages)
- [ ] CTA button text
- [ ] Mobile drawer labels

**DAY A STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY B — Structural Differentiation (APPLIES TO ALL 8,000+ PAGES)

> This is the KEY differentiation step - changes layout for ALL pages
> Even pages with original content need new structure to avoid template fingerprinting

### B1 — Offer Page Section Reordering (ALL PAGES)

**Old WHP structure:**
1. Hero
2. About
3. Promo Details
4. How to Redeem
5. FAQ
6. Terms

**New DPC structure (MUST BE DIFFERENT):**
1. Hero
2. Highlights (NEW)
3. Key Benefits
4. About the Tool
5. Redeeming Your Discount
6. FAQs
7. Terms & Policies
8. Related Offers
9. Comparison Grid (optional)

- [ ] Implement new section order in offer page component
- [ ] Create new H2/H3 hierarchy
- [ ] Implement new semantic grouping
- [ ] This change affects ALL 8,000+ offer pages automatically

### B2 — Navigation Structure
- [ ] Reorder main nav links
- [ ] Reorder footer nav links
- [ ] Change mobile menu item order

### B3 — Breadcrumb Changes
- [ ] Update breadcrumb labels
- [ ] Change breadcrumb structure if needed

### B4 — Grid/Layout Adjustments
- [ ] Change offer card grid layout slightly
- [ ] Adjust spacing between sections
- [ ] Change card component order (title/badge/price)

### B5 — Internal Link Structure
- [ ] Adjust internal linking patterns
- [ ] Change "related offers" display order logic

**DAY B STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY C — Metadata & JSON-LD Regeneration

### C1 — Organization Schema
- [ ] New @id URI (https://digitalpromocodes.com/#organization)
- [ ] New description text
- [ ] New sameAs links (new social profiles)
- [ ] Update logo URL

### C2 — WebSite Schema
- [ ] New @id URI
- [ ] New name
- [ ] New description
- [ ] Update potentialAction search URL

### C3 — Product/Offer Schema (per offer page)
- [ ] New description patterns
- [ ] New @id URI patterns
- [ ] Verify all references use new domain

### C4 — FAQPage Schema
- [ ] Regenerate with new question phrasing
- [ ] Regenerate with new answer text
- [ ] Verify @id URIs are new

### C5 — BreadcrumbList Schema
- [ ] Update itemListElement names
- [ ] Verify all URLs use new domain

### C6 — Meta Tags
- [ ] New meta description templates (different sentence structure)
- [ ] Regenerate all offer page meta descriptions
- [ ] Update homepage meta description
- [ ] Update blog meta descriptions

### C7 — Canonical URLs
- [ ] Verify all canonical tags point to digitalpromocodes.com
- [ ] No references to whpcodes.com anywhere

**DAY C STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY D — WHP/Whop Reference Cleansing

### D1 — Code Audit (grep searches)
- [ ] Grep for "whp" (case insensitive)
- [ ] Grep for "whop" (case insensitive)
- [ ] Grep for "whpcodes" (case insensitive)
- [ ] Grep for "WHP" (exact)
- [ ] Grep for "Whop" (exact)
- [ ] Grep for "offerhub" (case insensitive)

### D2 — File Locations to Check
- [ ] All .tsx files
- [ ] All .ts files
- [ ] All .css files
- [ ] All .json files
- [ ] All .md files
- [ ] package.json (name field)
- [ ] Comments in code
- [ ] Console.log statements
- [ ] Error messages

### D3 — Assets Check
- [ ] Image filenames
- [ ] Alt text in images
- [ ] Data files in /data
- [ ] Public folder assets

### D4 — Legacy/Disabled Files
- [ ] __locale_disabled folder - DELETE or fully clean
- [ ] Any backup files
- [ ] Any .bak or .old files

### D5 — Analytics/Tracking
- [ ] Remove any old GA tracking IDs
- [ ] Remove any old Tag Manager IDs
- [ ] Remove any WHP-specific tracking

**DAY D STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY E — Visual Identity Reset (AFTER Content)

### E1 — Color Palette
- [ ] Define new primary color (NOT old WHP colors)
- [ ] Define new secondary color
- [ ] Define new accent color
- [ ] Update CSS variables in globals.css
- [ ] Update Tailwind config if needed

### E2 — Logo & Favicon
- [ ] Create new logo (wordmark or symbol+wordmark)
- [ ] Generate favicon.ico (16x16, 32x32)
- [ ] Generate apple-touch-icon.png (180x180)
- [ ] Generate og-image.png for social sharing
- [ ] Update /public/favicon.ico
- [ ] Update site.webmanifest

### E3 — Typography
- [ ] Review/change font family if needed
- [ ] Adjust font-size scale (different rhythm)
- [ ] Adjust font-weight usage patterns

### E4 — Header Layout Changes
- [ ] Change header spacing/padding
- [ ] Adjust logo size/position
- [ ] Change mobile menu layout

### E5 — Footer Layout Changes
- [ ] Change footer spacing
- [ ] Update footer column layout

### E6 — Button & Component Styling
- [ ] Update button styles
- [ ] Update card hover effects
- [ ] Update form input styles

**DAY E STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY F — Deploy to Vercel (STAGING ONLY)

### F1 — Create New Vercel Project
- [ ] Go to Vercel → New Project
- [ ] Import from GitHub: 10aburnett/DigitalPromoCodes
- [ ] Select branch: main
- [ ] Project name: digitalpromocodes

### F2 — Environment Variables
- [ ] Set DATABASE_URL
- [ ] Set SITE_ORIGIN=https://digitalpromocodes.com
- [ ] Set AUTH_SECRET
- [ ] Set all other required env vars
- [ ] DO NOT reuse old WHP env var values for tracking

### F3 — Staging Verification
- [ ] Deploy to Vercel preview URL
- [ ] Test all pages load correctly
- [ ] Verify no WHP references in rendered HTML
- [ ] Check view-source for any WHP strings
- [ ] Verify JSON-LD in page source
- [ ] Verify meta tags
- [ ] Test on mobile

### F4 — DO NOT Connect Domain Yet
- [ ] Domain stays disconnected until Day G

**DAY F STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## DAY G — Go Live & GSC Setup

### G1 — Connect Domain
- [ ] Add digitalpromocodes.com to Vercel project
- [ ] Configure DNS (A record / CNAME)
- [ ] Verify SSL certificate is active
- [ ] Test https://digitalpromocodes.com loads

### G2 — Create New Google Search Console Property
- [ ] Go to search.google.com/search-console
- [ ] Add property: digitalpromocodes.com
- [ ] Verify ownership (DNS or HTML file)
- [ ] DO NOT import from old WHP property

### G3 — Create New GA4 Property
- [ ] Create new GA4 property (NOT reuse old one)
- [ ] Get new Measurement ID
- [ ] Update tracking code in app
- [ ] Verify events are firing

### G4 — Submit Sitemaps
- [ ] Submit sitemap.xml to GSC
- [ ] Verify sitemap is accepted
- [ ] Check for any errors

### G5 — Initial URL Submission
- [ ] Use URL Inspection tool
- [ ] Submit 10-15 high-priority URLs manually
- [ ] Request indexing for each

### G6 — Batch Indexing (Ongoing)
- [ ] Run: npx ts-node scripts/batch-indexing.ts --generate-all
- [ ] Submit 50-100 URLs per day
- [ ] Monitor indexing progress in GSC

**DAY G STATUS:** [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

---

## Final Pre-Launch Verification

Before going live, confirm Google will NOT see:

- [ ] Same text content
- [ ] Same JSON-LD schema patterns
- [ ] Same section order on pages
- [ ] Same menu structure
- [ ] Same favicon
- [ ] Same color theme
- [ ] Same logo
- [ ] Same GA/Tag IDs
- [ ] Same sitemap structure
- [ ] Any "whp", "whop", or "whpcodes" references

Google SHOULD see:

- [ ] New brand name everywhere
- [ ] New layout structure
- [ ] New semantic content
- [ ] New metadata patterns
- [ ] New JSON-LD identifiers
- [ ] New visual design
- [ ] New crawl footprint

---

## Outstanding Decisions Required

### 1. Structure Approach (before Day B)

**Option A — Full Structural Reset (RECOMMENDED)**
- NEW section order
- NEW headings
- NEW grouping
- Maximum SEO differentiation

**Option B — Same Structure, New Content**
- Safer, less layout change
- Still safe but less differentiation

**DECISION:** _____________

### 2. Visual Style (before Day E)

Options:
- Clean SaaS
- Deep-blue corporate
- Neon techy
- Minimalist white+gold
- Crypto-style gradient
- Dark mode first
- Other: _____________

**DECISION:** _____________

### 3. Logo Type (before Day E)

- Wordmark only
- Symbol + wordmark

**DECISION:** _____________

---

## Progress Log

| Date | Day | Tasks Completed | Notes |
|------|-----|-----------------|-------|
| 2024-12-03 | Pre | Repo renamed, brand constants updated, pushed to GitHub | Ready for differentiation phase |
| 2024-12-03 | Pre | Writing style decided: Conversion-Optimised Tech-Editorial | Per ChatGPT recommendation |
| | | | |
| | | | |
| | | | |

---

## Notes

- Old WHP Vercel project is frozen (Git disconnected)
- whpcodes.com still serving 410/noindex (leave it)
- New repo: https://github.com/10aburnett/DigitalPromoCodes
- DO NOT deploy until ALL differentiation steps are complete
- Content rewrites are MORE important than visual changes for Google
- Textual content is Google's PRIMARY duplication detector
