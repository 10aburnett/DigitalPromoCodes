# SEO REBRAND MASTER CONTEXT

## Overview
Full SEO identity reset for Next.js project (formerly WHP Codes). Goal: Launch completely new domain that Google interprets as brand new entity.

---

## 1. NON-NEGOTIABLE: ZERO OLD DOMAIN REFERENCES

Remove ALL references to old domain from:
- Code comments
- Canonical URLs
- JSON-LD @id values
- Meta tags
- Imports
- Environment variables
- Sitemap
- robots.txt
- Social/profile links
- Analytics IDs
- Brand names
- Image filenames/alt text
- CSP/source URLs
- Structured Organization schema

**Search commands to verify:**
```bash
rg -i "whp" -n
rg -i "whpcodes" -n
rg -i "whop" -n
rg -i "promo" -n
rg -i "code" -n
```

---

## 2. CODEBASE TRANSFORMATION

### A. Route Renaming
- `/whop/[slug]` → `/offer/[slug]` (or new structure)
- Update all routes containing "whop", "code", "coupon"
- Update import paths, Links, breadcrumbs, navigation

### B. Component Renaming
- `.whop-card` → `.offer-card`
- `WhopCard.tsx` → `OfferCard.tsx`
- `RecommendedWhopsServer.tsx` → `RecommendedOffersServer.tsx`

### C. Metadata System
- New title patterns
- New description patterns
- New heading hierarchy
- New alt tags
- New intro paragraphs
- Remove deterministic patterns from old structure

### D. JSON-LD Regeneration
For every page type:
- Product/Offer schema
- FAQPage schema
- BreadcrumbList schema
- Organization schema
- WebSite schema

Requirements:
- New @id values
- New wording
- No strings from old site
- New URL paths
- New brand name

### E. Environment Variables
Remove/replace:
- NEXT_PUBLIC_DOMAIN
- NEXT_PUBLIC_SITE_URL
- GA4/Plausible/GTM IDs
- Search Console verification tokens
- AdSense codes
- Hardcoded whpcodes.com URLs

### F. Verification Assets
Delete:
- `public/googleXXXX.html`
- Meta verification strings

---

## 3. CONTENT REGENERATION

### Strategy
1. Use evidence from tool page if available
2. If insufficient, use category template:
   - Crypto
   - E-commerce
   - Education
   - Trading/finance
   - Amazon/ecom
   - Fitness
   - AI tools
   - SaaS
   - Real estate
   - Betting/gambling
   - Community/Discord

### Paraphraser Requirements
- Rewrite all paragraphs in new style
- Avoid old phrasal patterns
- Vary sentence structure
- Semantic shifts, not just synonyms
- Generate unique, human-like text

---

## 4. VISUAL REBRAND

### Images
Replace or transform:
- Icons, thumbnails, banners, screenshots, logos
- Apply: crop, color adjust, compress, borders, rotation

### Stylesheet
- Change color palette
- Adjust padding/margins
- Change base font sizes
- Update Tailwind config
- Alter layout grid for cards

---

## 5. TECHNICAL FINGERPRINT RESET

- Change folder order
- Change import order
- Rename variables
- Modify component hierarchy
- Add/remove wrappers (`<section>` → `<div>`)
- Minimize identical hashes between builds

---

## 6. NEW DOMAIN SITEMAP & ROBOTS

Generate:
- Fresh sitemap for new URL structure
- New robots.txt permitting crawling
- Correct canonical URL base
- Properly formatted absolute URLs

---

## 7. OLD DOMAIN DECOMMISSIONING

### Phase 1 (LIVE)
- `noindex, nofollow, noarchive` everywhere
- Empty sitemap
- robots.txt allows crawling
- Middleware forcing noindex header

### Phase 2 (NEXT)
- robots.txt disallow-all
- GSC prefix removal

### Phase 3 (FINAL)
- 410 Gone for all public routes
- Keep 410 + noindex for weeks

**CRITICAL: Never make old domain indexable again**

---

## 8. NEW DOMAIN LAUNCH SEQUENCE

1. Deploy new site (indexable)
2. Add to GSC
3. Submit sitemap
4. Request manual indexing (home + ~10 key pages)
5. Begin backlink acquisition
6. NEVER link old → new
7. Ensure new meta + JSON-LD completely new
8. Wait 2-4 weeks for stable indexing

---

## 9. CLAUDE RULES

**MUST:**
- Ask before mass-renaming directories
- Use automated search to verify no legacy references
- Ensure all SEO metadata is rewritten, not copied
- Check every file for legacy domain leakage

**NEVER:**
- Reintroduce old domain references
- Reuse old titles/descriptions
- Preserve old naming conventions
- Regenerate identical JSON-LD text
- Copy old patterns

---

## 10. EXECUTION CHECKLIST

- [ ] Route renaming
- [ ] Code refactoring
- [ ] Metadata regeneration
- [ ] JSON-LD regeneration
- [ ] Sitemap/robots creation
- [ ] Visual rebrand
- [ ] Remove legacy identifiers
- [ ] Set up environment variables
- [ ] Write automation scripts
- [ ] Verify no leftover references
- [ ] Prepare new-domain deployment
- [ ] Supervise old-domain deindexing

---

## REMEMBER: DATABASE SAFETY

**NEVER USE:**
- `npx prisma db push --force-reset`
- `npx prisma migrate reset`
- Any command with "reset" or "--force"

**SAFE COMMANDS:**
- `npx prisma db push`
- `npx prisma migrate dev`
- `npx prisma generate`
