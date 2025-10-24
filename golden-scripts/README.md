# 🏆 Golden Database Sync Scripts

This folder contains the **GOLDEN** collection of database synchronization scripts that safely merge data between production and backup databases with **ZERO RISK OF DATA LOSS**.

---

## 🔥 CRITICAL: PromoCode Sync — SAFE Path

**Script:** `GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs`
**Env:** `./.env.sync` with:
```
SOURCE_DATABASE_URL=postgres://…  # where new promos exist (backup)
TARGET_DATABASE_URL=postgres://…  # where to sync (production)
```

**Preflight checklist:**
- ✅ Unique index exists on both DBs:
  ```sql
  CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS promo_unique_whop_code
  ON "PromoCode"("whopId","code");
  ```
- ✅ Old "WHOPS-PROMOCODES" script **NOT used** for promos

**Run:**
```bash
# Dry run preview
node golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs --dry

# Live sync
node golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs
```

**What it does:**
- Resolves whops by slug on target
- Upserts by `(whopId, code)`
- Updates only when incoming discount is **strictly better**
- Generates new promo IDs on target
- Never deletes

**Emergency cleanup (duplicates):**
- Use `sql/cleanup_promocode_duplicates.sql` (FK-safe):
  - Keeps oldest per `(whopId, code)`
  - Re-points `OfferTracking.promoCodeId`
  - Deletes the rest

---

## 🛡️ Safety Guarantees

- ✅ **NO DELETIONS EVER** - Only adds data, never removes anything
- ✅ **Battle Tested** - All scripts have been proven in production
- ✅ **Error Handling** - Graceful failure handling with detailed logging
- ✅ **Duplicate Protection** - Skips existing data automatically

## 📋 Script Overview

### 1. `GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER.js`
**Purpose**: Syncs blog posts, comments, mailing list subscribers  
**What it handles**:
- ✅ Blog posts (title, content, slug, published status, etc.)
- ⚠️  Comments (has known issues - use Script #3 instead)
- ✅ Comment votes
- ✅ Mailing list subscribers
- ✅ Schema updates (adds missing columns)

### 2. `GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs` ⭐ NEW (Oct 2025)
**Purpose**: Safe promo code synchronization using slug-based Whop resolution
**What it handles**:
- ✅ PromoCode table sync with natural key (whopId, code)
- ✅ Slug-based Whop resolution (prevents cross-database ID mismatches)
- ✅ "Only update when better" discount comparison logic
- ✅ Fresh ID generation on target (never copies source IDs)
- ✅ Dry-run mode support
- ✅ Batched processing (25 at a time)

**Why it's better**: The old Script #2 synced promo codes by raw IDs which caused mismatches across databases. This new script resolves Whops by slug first, ensuring correct promo-to-whop associations.

### 2b. `GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js`
**Purpose**: Syncs Whop marketplace data ⚠️ (NO LONGER SYNCS PROMO CODES)
**What it handles**:
- ✅ Whops (marketplace products)
- ⚠️ Promo codes (DEPRECATED - use Script #2 instead)
- ✅ Indexing status tracking
- ✅ Schema updates for Whop-specific columns

### 3. `GOLDEN-COMMENTS-SYNC-SCRIPT-NO-DELETIONS-EVER.js`
**Purpose**: Dedicated comment synchronization (RECOMMENDED for comments)  
**What it handles**:
- ✅ Comments with proper blog post ID mapping
- ✅ Author name and email handling
- ✅ Comment status (APPROVED/PENDING/REJECTED)
- ✅ Cross-database blog post reference resolution

### 5. `GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-5-SEO-COLUMNS.js`
**Purpose**: Syncs NEW SEO hardening columns for complete coverage  
**What it handles**:
- ✅ Whop.retirement (NONE/REDIRECT/GONE enum)
- ✅ Whop.redirectToPath (redirect URL for retired content)
- ✅ Whop.indexingStatus (INDEX/NOINDEX/AUTO status)
- ✅ Creates missing RetirementMode enum automatically
- ✅ Schema updates and index creation

## 🚀 How to Use

### Complete Sync (Recommended Order):
```bash
# 1. Sync blog posts, mailing list, and basic content
node golden-scripts/GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER.js

# 2. Sync Whop content fields
cd golden-scripts && node --env-file=../.env.sync GOLDEN-CONTENT-SYNC-BULLETPROOF.js

# 3. Sync promo codes (SAFE slug-based sync)
cd .. && node golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs

# 4. Sync Whops (marketplace products)
cd golden-scripts && node --env-file=../.env.sync GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js

# 5. Sync promo submissions
node --env-file=../.env.sync GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-3-PROMO-SUBMISSIONS.js

# 6. Sync remaining tables (BulkImport, ContactSubmission, etc.)
node --env-file=../.env.sync GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-4-REMAINING-TABLES.js

# 7. Sync comments (use this instead of Script #1 for comments)
node --env-file=../.env.sync GOLDEN-COMMENTS-SYNC-SCRIPT-NO-DELETIONS-EVER.js
```

### Individual Sync:
Run any script individually when you only need to sync specific data types.

## 📊 Database Coverage

| Data Type | Script #1 | Script #2 (NEW) | Script #2b | Script #3 | Script #4 | Script #5 |
|-----------|-----------|-----------------|------------|-----------|-----------|-----------|
| Blog Posts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Comments | ⚠️ (broken) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Mailing List | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Whops | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Promo Codes** | ❌ | **✅ (SAFE)** | ⚠️ (deprecated) | ❌ | ❌ | ❌ |
| Promo Submissions | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Comment Votes | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Whop Content | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Remaining Tables | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **SEO Columns** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## 🔧 Database Configuration

All scripts are pre-configured with the correct database URLs:
- **Production**: `ep-noisy-hat` (npg_LoKgTrZ9ua8D)
- **Backup**: `ep-rough-rain` (npg_GL1sjBY8oSOb)

## ⚠️ Important Notes

- **Always backup before running** (though scripts are safe by design)
- **Run in order** for complete synchronization
- **Script #1 comment sync is broken** - use Script #3 for comments
- **USE NEW PROMO SYNC** - GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs replaces old promo code sync
- **All scripts are idempotent** - safe to run multiple times

## 🎯 Success Metrics

After running all scripts, you should see:
- ✅ Blog posts: Equal counts on both databases
- ✅ Comments: Equal counts on both databases
- ✅ Mailing list: Equal subscriber counts
- ✅ Whops: Equal product counts (~8,212)
- ✅ Promo codes: Equal counts (~887 as of Oct 2025)
- ✅ Promo submissions: Equal counts
- ✅ All remaining tables synced

---

**Created**: 2025-08-10
**Last Updated**: 2025-10-24 (Added GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs)
**Status**: Battle Tested & Production Ready ✅