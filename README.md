# Crypto Bonuses

A modern web application for discovering and comparing cryptocurrency casino bonuses. Built with Next.js, TypeScript, and Tailwind CSS.

<!-- Deployment trigger: Phase 1 NOINDEX deindexing deployed 2025-11-16 -->

## 🔒 Golden Playbooks (Do This, Not That)

### Promo codes (PromoCode table)

**ALWAYS use:** `golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs`
**NEVER use:** `GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js` (DEPRECATED for promos)

**Why:** Promo sync must use the natural key `(whopId, code)` and resolve whops by `slug`. The old script compared raw IDs and created duplicates.

**DB invariants (now enforced):**
- Unique index on `("PromoCode"."whopId","code")` — present on **backup** and **production**.

**Standard runbook (backup ➜ production):**
1. Import new promos (CSV) into **backup** via admin UI.
2. Dry-run sync:
   ```bash
   node golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs --dry
   ```
3. Live sync:
   ```bash
   node golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs
   ```
4. Post-checks (both DBs):
   ```sql
   -- 0 duplicate groups expected
   SELECT COUNT(*) FROM (
     SELECT "whopId","code", COUNT(*) FROM "PromoCode"
     GROUP BY 1,2 HAVING COUNT(*) > 1
   ) x;
   ```

**If duplicates ever appear again (e.g., someone ran an old script):**
- Use `golden-scripts/sql/cleanup_promocode_duplicates.sql` pattern:
  - Re-point `OfferTracking.promoCodeId` to the **oldest** `(whopId, code)` survivor
  - Delete later duplicates
  - Re-verify duplicate groups = 0

> TL;DR: Safe script only, unique index in place, verify 0 duplicates.

## Features 

- Browse and search through various cryptocurrency casino bonuses
- Filter bonuses by type (deposit, free, free spins, etc.)
- Sort bonuses by value or alphabetically
- Copy promo codes with one click
- Responsive design for all devices
- Modern UI with smooth animations

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- React
- ESLint

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cryptobonuses.git
cd cryptobonuses
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── layout.tsx    # Root layout component
│   ├── page.tsx      # Home page component
│   └── globals.css   # Global styles
├── components/       # React components
│   ├── CasinoCard.tsx
│   └── FilterControls.tsx
├── data/            # Data files
│   └── casinoBonuses.ts
└── types/           # TypeScript type definitions
    └── casino.ts
```

## Whop Freshness Verification System

### Automated Database-Based Freshness Sync
The system automatically creates freshness data for all whops with existing promo codes:

```bash
# Generate freshness JSON files for all whops with promo codes
npm run freshness:sync
```

This command:
- Reads your database to find all published whops with promo codes
- Creates `data/pages/{slug}.json` files for each whop
- Provides SEO-critical "Verification Status" sections above the fold
- **No external scraping** - only uses your existing database

### Automation Options

#### 🔄 **Automatic (Currently Disabled)**
- **GitHub Actions can run every 6 hours** (currently commented out)
- Uses `.github/workflows/refresh-freshness-db.yml`
- To enable: uncomment the `schedule:` section in the workflow file
- Connects to your database, syncs freshness data
- Auto-commits any changes to the repo
- Your site rebuilds automatically with fresh data

#### ⚡ **Manual Trigger**
- Go to your GitHub repo → Actions tab
- Click "Refresh Freshness from Database" → "Run workflow"
- Runs immediately on-demand

#### 🖥️ **Local Development**
- `npm run freshness:sync` locally
- Then push changes manually

### Manual Verification Process
To manually verify a promo code actually works at checkout:

1. **Locate the JSON file**: `data/pages/{slug}.json`
2. **Add verification data**:
   ```json
   {
     "code": "PROMO-CODE",
     "status": "working",
     "before": "$100.00",
     "after": "$80.00",
     "notes": "Manually tested at checkout - confirmed working",
     "checkedAt": "2025-09-18T10:32:00Z",
     "verifiedAt": "2025-09-18T11:15:00Z"
   }
   ```
3. **The difference**:
   - `checkedAt` only = Shows "Last checked" in blue (found on product page)
   - `verifiedAt` set = Shows "Last verified" in green (actually tested at checkout)

This provides maximum trust signals for SEO while maintaining honest verification status.

### Screenshot Proof Upload Process
To add visual verification screenshots (Figure B) to whop pages:

1. **Save screenshot**: Name it `{slug}-proof-2025-09.png` (lowercase slug, PNG format)
2. **Upload to**: `/public/images/howto/` directory
3. **Update manifest**: Add the slug to `/data/proof-manifest.json` in the `slugs` array
4. **Component configuration**: Ensure `HowToSection.tsx` uses `.png` extension in `proofPathForSlug` function

**Example for "best-of-both-worlds" whop:**
- Screenshot file: `best-of-both-worlds-proof-2025-09.png`
- Manifest entry: `"best-of-both-worlds"` (in slugs array)
- Displays as "Figure B" with discount verification

**Important**: Slug names must match exactly between the whop page slug and the manifest entry for the screenshot to display.

### Comprehensive Discount Pricing & SEO Integration

The system now provides **complete before/after pricing** for all promo codes with automatic sitemap updates:

#### 📊 **Update Discount Pricing**

```bash
# Update ALL whops with comprehensive discount pricing
npm run freshness:real

# Update single whop (for testing)
WHOP_SLUG=premium npm run freshness:real

# Test without writing files
npm run freshness:real --dry-run
WHOP_SLUG=premium npm run freshness:real --dry-run
```

#### 🗺️ **Regenerate Sitemaps with Fresh Lastmod**

```bash
# Rebuild sitemaps with freshness-aware lastmod timestamps
npm run sitemap:build

# Combined: Update pricing + regenerate sitemaps (RECOMMENDED)
npm run freshness:real+site

# Combined for single whop
WHOP_SLUG=premium npm run freshness:real+site
```

#### ✨ **What These Commands Do:**

**`npm run freshness:real`:**
- Processes ALL promo codes (not just "promo-" prefix)
- Calculates real before/after pricing with pattern matching ("HALFOFF", "FREE", "$29.00 off")
- Stores numeric data (beforeCents/afterCents) + formatted display strings
- Adds "best discount" summary blocks for fast above-the-fold rendering
- Uses atomic writes and triggers Next.js page revalidation
- Updates 51+ JSON files with complete pricing data

**`npm run sitemap:build`:**
- Reads freshness JSON files to get the latest verification timestamps
- Computes `lastmod = max(file.lastUpdated, ledger[].verifiedAt/checkedAt)`
- Updates sitemaps with accurate freshness-aware lastmod dates
- Tells search engines exactly when content was last verified

**`npm run freshness:real+site`:**
- **One command pipeline** that updates pricing AND sitemaps
- Perfect for production deployments
- Ensures search engines see accurate lastmod reflecting actual content freshness

### Auto Bot System (Monitoring vs Verification)

The system includes two different automated scripts with distinct purposes:

#### 🤖 **Auto-Check Bot** (`scripts/auto-check-whops.mjs`)
**Purpose:** Lightweight monitoring to check if codes are still present on whop pages
```bash
npm run freshness:check
```

**What it does:**
- Visits each whop URL and scans page source for popup promo codes
- **Only updates:** `checkedAt` timestamp when codes are found
- **Does NOT update:** verification status, pricing data, or "Last tested" timestamps
- **Use case:** Monitoring code presence without actual verification

#### ✅ **Verification Bot** (`scripts/verify-promo-codes.ts`)
**Purpose:** Mark known good codes as verified working
```bash
npm run verify:promo-codes
```

**What it does:**
- Finds codes starting with "promo-" and marks them as verified
- **Updates:** `status: 'working'`, `checkedAt`, and `verifiedAt` timestamps
- **Use case:** Bulk verify codes you know are working

#### 📝 **"Last tested" vs Auto Bot**
**Important:** The "Last tested" line in HowTo sections uses `data.best?.computedAt` which is **separate** from auto-check:

- ✅ **Auto-check updates:** Only `checkedAt` (monitoring)
- ❌ **Auto-check does NOT update:** `computedAt`, pricing data, or verification status
- 🔧 **To update "Last tested":** Manually edit JSON files with actual test results

### Freshness Scripts & Workflows
- `scripts/freshness-sync.ts` - Database-based freshness sync (main method)
- `scripts/add-real-discount-data.ts` - **Comprehensive discount pricing** with all promo codes
- `scripts/build-sitemaps.ts` - **Freshness-aware sitemap generation** with accurate lastmod
- `scripts/auto-check-whops.mjs` - **Auto monitoring bot** (checks code presence only)
- `scripts/verify-promo-codes.ts` - **Verification bot** (marks promo- codes as working)
- `scripts/normalize-freshness.mjs` - Clean up existing JSON files
- `.github/workflows/refresh-freshness-db.yml` - **Primary automation** (every 6 hours)
- `.github/workflows/refresh-freshness.yml` - Legacy workflow

## Managing Gone/Retired URLs for Future Affiliate Access

**Background:** 2,354 whop URLs are currently retired (410 status) but preserved in the database for future affiliate partnership opportunities.

### Accessing Gone URLs

**1. Generate gone.xml sitemap:**
```bash
INCLUDE_TEMP_SITEMAPS=1 npm run sitemap:build
# Creates: public/sitemaps/gone.xml (444KB with all 2,354 URLs)
```

**2. Extract URL lists:**
```bash
# Extract slug names only
grep -o "/whop/[^<]*" public/sitemaps/gone.xml | sed 's|/whop/||' > gone_slugs.txt

# Extract full URLs
grep -o "https://whpcodes.com/whop/[^<]*" public/sitemaps/gone.xml > gone_urls.txt
```

**3. Database query:**
```sql
SELECT slug, name FROM "Whop" WHERE retired = true OR retirement = 'GONE';
```

### Making Gone URLs Live Again

**When affiliate access is granted, follow these steps:**

**1. Update database status:**
```sql
-- For specific whops:
UPDATE "Whop" SET retired = false, retirement = 'NONE' WHERE slug IN ('whop-slug-1', 'whop-slug-2');

-- For all retired whops (use with caution):
UPDATE "Whop" SET retired = false, retirement = 'NONE' WHERE retired = true;
```

**2. Regenerate SEO indexes:**
```bash
npm run seo:build-indexes
```

**3. Update sitemaps:**
```bash
npm run sitemap:build
```

**4. Optional - Add freshness data:**
```bash
npm run freshness:real
npm run freshness:real+site
```

**Note:** Gone URLs automatically get `410 status` + `X-Robots-Tag: noindex` until reactivated.

## Deterministic Site Graph & Internal Linking System

### Overview

The application uses a deterministic site graph system to eliminate orphan pages and provide stable internal linking for SEO. This system pre-calculates all internal relationships and stores them as JSON artifacts, ensuring every whop page has guaranteed inbound links.

### Key Benefits

- **Zero Orphan Pages**: Every whop is guaranteed minimum 3 inbound links
- **Deterministic Links**: Internal links never change between page refreshes
- **SEO Safety**: Gone/404 URLs are completely excluded from internal linking
- **Performance**: Pre-calculated relationships served from static JSON
- **Instant Rollback**: Feature flag allows immediate switching between graph and live API

### System Architecture

#### 1. Graph Generation (`scripts/build-graph.ts`)

**Purpose:** Builds the complete site graph by analyzing all active whops and computing similarity relationships.

```bash
# Generate the site graph (runs automatically in prebuild)
npm run build:graph
```

**Process:**
1. Loads all whops from database
2. Excludes gone/retired whops using `gone.xml` sitemap
3. Extracts topics using regex patterns (`src/lib/topics.ts`)
4. Calculates recommendation scores (category match + topic similarity + price + quality)
5. Calculates alternative scores (Jaccard similarity + price affinity)
6. Guarantees minimum 3 inbound links per whop (eliminates orphans)
7. Generates deterministic JSON artifacts

**Output Files:**
- `public/data/graph/neighbors.json` - Recommendations and alternatives for each whop
- `public/data/graph/topics.json` - Whops grouped by topic
- `public/data/graph/inbound-counts.json` - Inbound link counts per whop
- `public/data/graph/stats.json` - Statistics and validation metrics

#### 2. Graph Loader (`src/lib/graph.ts`)

**Purpose:** Cached loader for accessing graph data with TypeScript types.

```typescript
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';

// Load complete neighbors map
const neighbors = await loadNeighbors();

// Get recommendations for a specific whop
const recommendations = getNeighborSlugsFor(neighbors, 'whop-slug', 'recommendations');

// Get alternatives for a specific whop
const alternatives = getNeighborSlugsFor(neighbors, 'whop-slug', 'alternatives');
```

#### 3. Component Integration

**RecommendedWhops Component (`src/components/RecommendedWhops.tsx`):**
- Graph-first: Loads slugs from `neighbors.json`, then fetches full details
- API fallback: Falls back to live API if graph unavailable
- Preserves all rich functionality (images, ratings, promo codes)

**Alternatives Component (`src/components/Alternatives.tsx`):**
- Graph-first: Gets slugs from `neighbors.json`
- Enrichment: Calls API to get SEO-friendly anchor text for graph slugs
- Editorial descriptions: Preserves editorial descriptions from API
- Fallback: Complete API fallback if graph fails

### Configuration

#### Environment Variables

```bash
# Enable/disable graph system (instant toggle)
NEXT_PUBLIC_USE_GRAPH_LINKS=true

# Base URL for graph JSON fetching
NEXT_PUBLIC_BASE_URL=https://whpcodes.com
```

#### Build Integration

The graph is automatically built during production builds:

```json
// package.json
"prebuild": "ts-node --transpile-only scripts/build-seo-indexes.ts && ts-node --transpile-only scripts/build-sitemaps.ts && npm run build:graph"
```

For CI environments without database access:
```bash
# Skip graph generation if no database
BUILD_GRAPH=1 npm run build  # Only runs when BUILD_GRAPH=1 is set
```

### Monitoring & Validation

#### Statistics Verification

Check `public/data/graph/stats.json` after each build:

```json
{
  "totalWhops": 5865,
  "totalGoneWhops": 2354,
  "totalTopics": 12,
  "inboundStats": {
    "min": 3,           // Should be >= 3 (guaranteed minimum)
    "max": 717,
    "avg": 8.29
  },
  "orphansEliminated": 2746,  // Number of orphans fixed
  "guaranteedMinimum": 3      // Minimum inbound links per whop
}
```

**Key Metrics:**
- `orphansEliminated` > 0 = System is working
- `inboundStats.min` >= 3 = No orphans remain
- `totalWhops` - `totalGoneWhops` = Active whops processed

#### Testing Procedures

**1. Test Graph Loading:**
```bash
curl http://localhost:3000/data/graph/neighbors.json | head -c 200
curl http://localhost:3000/data/graph/stats.json
```

**2. Test Feature Flag:**
```bash
# Enable graph
echo "NEXT_PUBLIC_USE_GRAPH_LINKS=true" >> .env.local

# Disable graph (fallback to API)
echo "NEXT_PUBLIC_USE_GRAPH_LINKS=false" >> .env.local
```

**3. Validate Build:**
```bash
npm run build:dev  # Should complete without TypeScript errors
```

### Troubleshooting

#### Common Issues

**1. Graph files not found (404):**
- Ensure `npm run build:graph` completed successfully
- Check files exist in `public/data/graph/`
- Verify `NEXT_PUBLIC_BASE_URL` is set correctly

**2. Components showing no recommendations:**
- Check browser console for fetch errors
- Verify whop slug exists in `neighbors.json`
- Test API fallback by setting `NEXT_PUBLIC_USE_GRAPH_LINKS=false`

**3. Build failures:**
- Ensure database is accessible during build
- Check `scripts/build-graph.ts` for error messages
- Verify Prisma client is properly configured

#### Rollback Procedure

To immediately revert to the old API-based system:

```bash
# 1. Disable graph feature
echo "NEXT_PUBLIC_USE_GRAPH_LINKS=false" >> .env.local

# 2. Restart application (components will use live APIs)
npm run dev
```

The system will instantly fall back to the original API behavior with no other changes required.

### Maintenance

#### Regular Tasks

**1. Regenerate graph after content changes:**
```bash
npm run build:graph  # After adding/removing whops
```

**2. Update CI/production environment:**
```bash
# Set in production environment
USE_GRAPH_LINKS=true
NEXT_PUBLIC_BASE_URL=https://whpcodes.com
BUILD_GRAPH=1  # For CI builds with database access
```

**3. Monitor orphan metrics:**
Check `stats.json` after each deployment to ensure `orphansEliminated` count and minimum inbound links.

### Technical Details

**Similarity Algorithms:**
- **Recommendations**: Category match (100pt) + topic similarity (80pt primary, 25pt secondary) + price match (10pt) + quality bonus (rating * 2pt)
- **Alternatives**: Jaccard similarity on topics (80% weight) + price affinity (20% weight)

**Orphan Elimination:**
- Identifies whops with < 3 inbound links
- Finds topically similar whops not already linking to the orphan
- Adds orphan to their alternatives lists until minimum threshold reached
- Deterministically sorts all relationships for stability

**Gone URL Safety:**
- `scripts/build-graph.ts` excludes gone slugs using `src/lib/gone.ts`
- API routes filter gone slugs using `isGoneSlug()` function
- Double protection ensures no 404 links in internal navigation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

<!-- Trigger redeploy with sitemap environment variables - 2025-08-28 --> 