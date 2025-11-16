# Whop Content Import Guide

## Problem Summary

ChatGPT correctly identified two issues:
1. **CSV headers don't match your database schema** - Your Prisma Whop model uses camelCase (`aboutContent`) but the old CSV had lowercase (`aboutcontent`)
2. **No UPSERT guarantee** - Without proper logic, you'd create 8,000+ duplicate Whops instead of updating existing ones

## Solution Overview

This guide shows you how to safely import AI-generated content into your Neon database **without creating duplicates**.

---

## Step 1: Regenerate CSV with Correct Headers

The exporter has been updated to match your Prisma schema exactly.

```bash
cd "/Users/alexburnett/Downloads/cryptobonusesnew copy 2"

# Generate new CSV with correct headers
TS=$(date -u +%Y%m%dT%H%M%S)
node scripts/successes-jsonl-to-csv.mjs \
  --in=data/content/master/successes.jsonl \
  --out=exports/whop-content-$TS.csv

# Verify headers
head -1 exports/whop-content-$TS.csv
```

**Expected output:**
```csv
slug,aboutContent,howToRedeemContent,promoDetailsContent,termsContent,faqContent,model,generated_at
```

**Key differences from old CSV:**
- ✅ `aboutContent` (was `aboutcontent`)
- ✅ `howToRedeemContent` (was `howtoredeemcontent`)
- ✅ `promoDetailsContent` (was `promodetailscontent`)
- ✅ `termsContent` (was `termscontent`)
- ✅ `faqContent` (was `faqcontent`)
- ❌ Removed `finalUrl` (not in your Whop model)

---

## Step 2: Import Using Prisma Upsert Script (RECOMMENDED)

This script **guarantees no duplicates** by:
1. Looking up each Whop by `slug` (which is `@unique` in your schema)
2. **UPDATE** if exists, **skip** if not found
3. Idempotent - can run multiple times safely

```bash
# Install Prisma Client if needed
npm install

# Run upsert
node scripts/upsert-whop-content.mjs --csv=exports/whop-content-YYYYMMDDTHHMMSS.csv
```

**What it does:**
- Finds existing Whops by `slug`
- Updates `aboutContent`, `howToRedeemContent`, `promoDetailsContent`, `termsContent`, `faqContent`
- Skips slugs not found in DB (these are AI-generated content for Whops you haven't manually created yet)
- **Zero risk of duplicates** - uses Prisma's `update()` which requires unique key

**Expected output:**
```
Starting upsert from: exports/whop-content-20251116T120836.csv

Headers: slug, aboutContent, howToRedeemContent, promoDetailsContent, termsContent, faqContent, model, generated_at

Updated 100 Whops...
Updated 200 Whops...
...

=== Upsert Complete ===
Total rows processed: 8181
Whops updated: 8050
Whops created: 0
Errors/skipped: 131

Slugs not found in DB (131):
vinted-money-maker
... (AI-generated content for Whops not yet in DB)
```

---

## Step 3: (Optional) Fix FAQ Content Type

Your Prisma schema currently has:
```prisma
faqContent String?
```

But it should be `Json` for proper JSONB storage:

```prisma
faqContent Json?
```

**Migration:**

1. Edit `prisma/schema.prisma`:
```diff
- faqContent        String?
+ faqContent        Json?
```

2. Create migration:
```bash
npx prisma migrate dev --name "change-faq-content-to-json"
```

3. Push to production:
```bash
npx prisma migrate deploy
```

This allows you to query FAQ data with Prisma's JSON operators instead of string parsing.

---

## Alternative: Direct SQL Import (Advanced)

If you prefer SQL over Prisma (faster for large batches):

### Step 1: Create Staging Table

```sql
CREATE TABLE IF NOT EXISTS whop_content_staging (
  slug                 text PRIMARY KEY,
  "aboutContent"       text,
  "howToRedeemContent" text,
  "promoDetailsContent" text,
  "termsContent"       text,
  "faqContent"         text,
  model                text,
  generated_at         text
);
```

### Step 2: Load CSV

```sql
\copy whop_content_staging(
  slug,
  "aboutContent",
  "howToRedeemContent",
  "promoDetailsContent",
  "termsContent",
  "faqContent",
  model,
  generated_at
)
FROM '/absolute/path/to/exports/whop-content-YYYYMMDDTHHMMSS.csv'
WITH (FORMAT csv, HEADER true, QUOTE '"', ESCAPE '"');
```

### Step 3: Upsert to Main Table

```sql
UPDATE "Whop" AS w
SET
  "aboutContent" = s."aboutContent",
  "howToRedeemContent" = s."howToRedeemContent",
  "promoDetailsContent" = s."promoDetailsContent",
  "termsContent" = s."termsContent",
  "faqContent" = s."faqContent",
  "updatedAt" = now()
FROM whop_content_staging AS s
WHERE w.slug = s.slug;

-- Check results
SELECT COUNT(*) AS updated FROM "Whop" WHERE "aboutContent" IS NOT NULL;
```

### Step 4: Cleanup

```sql
DROP TABLE whop_content_staging;
```

---

## Why This Won't Create Duplicates

1. **Unique Constraint:** Your Whop model has `slug String @unique` (line 223 in schema.prisma)
2. **UPDATE Operation:** The upsert script uses `prisma.whop.update({ where: { slug } })` which **requires** the slug exists
3. **No INSERT for missing slugs:** If a slug isn't found, it's logged and skipped (not created)

**Result:** Existing Whops get AI content added, non-existent slugs are logged for you to create manually first.

---

## Verification After Import

```bash
# Count Whops with AI content
npx prisma studio

# Or via SQL:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Whop\" WHERE \"aboutContent\" IS NOT NULL;"
```

---

## Troubleshooting

### "Slug not found in DB"
**Cause:** AI generated content for a Whop that doesn't exist in your database yet
**Fix:** Either create those Whops manually first, or ignore (they're not critical)

### "CSV headers don't match"
**Cause:** Using old CSV export
**Fix:** Regenerate using Step 1 above

### "Duplicate key value violates unique constraint"
**Cause:** You're using INSERT instead of UPDATE
**Fix:** Use the Prisma upsert script (Step 2) which uses UPDATE only

---

## Next Run

When you regenerate content in the future:

```bash
# 1. Export new CSV
TS=$(date -u +%Y%m%dT%H%M%S)
node scripts/successes-jsonl-to-csv.mjs \
  --in=data/content/master/successes.jsonl \
  --out=exports/whop-content-$TS.csv

# 2. Upsert (idempotent, safe to re-run)
node scripts/upsert-whop-content.mjs --csv=exports/whop-content-$TS.csv
```

No duplicates, ever. Guaranteed by `@unique` constraint on `slug`.
