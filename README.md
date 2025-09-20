# Crypto Bonuses

A modern web application for discovering and comparing cryptocurrency casino bonuses. Built with Next.js, TypeScript, and Tailwind CSS.

<!-- Deployment trigger: Comment voting system fixed 2025-09-14 -->

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

<!-- Trigger redeploy with sitemap environment variables - 2025-08-28 --> 