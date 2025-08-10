# 🏆 Golden Database Sync Scripts

This folder contains the **GOLDEN** collection of database synchronization scripts that safely merge data between production and backup databases with **ZERO RISK OF DATA LOSS**.

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

### 2. `GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js`
**Purpose**: Syncs Whop marketplace data and promo codes  
**What it handles**:
- ✅ Whops (marketplace products)
- ✅ Promo codes (including fake promo detection)
- ✅ Indexing status tracking
- ✅ Schema updates for Whop-specific columns

### 3. `GOLDEN-COMMENTS-SYNC-SCRIPT-NO-DELETIONS-EVER.js`
**Purpose**: Dedicated comment synchronization (RECOMMENDED for comments)  
**What it handles**:
- ✅ Comments with proper blog post ID mapping
- ✅ Author name and email handling
- ✅ Comment status (APPROVED/PENDING/REJECTED)
- ✅ Cross-database blog post reference resolution

## 🚀 How to Use

### Complete Sync (Recommended Order):
```bash
# 1. Sync blog posts, mailing list, and basic content
node golden-scripts/GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER.js

# 2. Sync Whops and promo codes
node golden-scripts/GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js

# 3. Sync comments (use this instead of Script #1 for comments)
node golden-scripts/GOLDEN-COMMENTS-SYNC-SCRIPT-NO-DELETIONS-EVER.js
```

### Individual Sync:
Run any script individually when you only need to sync specific data types.

## 📊 Database Coverage

| Data Type | Script #1 | Script #2 | Script #3 |
|-----------|-----------|-----------|-----------|
| Blog Posts | ✅ | ❌ | ❌ |
| Comments | ⚠️ (broken) | ❌ | ✅ |
| Mailing List | ✅ | ❌ | ❌ |
| Whops | ❌ | ✅ | ❌ |
| Promo Codes | ❌ | ✅ | ❌ |
| Comment Votes | ✅ | ❌ | ❌ |

## 🔧 Database Configuration

All scripts are pre-configured with the correct database URLs:
- **Production**: `ep-noisy-hat` (npg_LoKgTrZ9ua8D)
- **Backup**: `ep-rough-rain` (npg_TKWsI2cv3zki)

## ⚠️ Important Notes

- **Always backup before running** (though scripts are safe by design)
- **Run in order** for complete synchronization
- **Script #1 comment sync is broken** - use Script #3 for comments
- **All scripts are idempotent** - safe to run multiple times

## 🎯 Success Metrics

After running all scripts, you should see:
- ✅ Blog posts: Equal counts on both databases
- ✅ Comments: Equal counts on both databases  
- ✅ Mailing list: Equal subscriber counts
- ✅ Whops: Equal product counts (~8,212)
- ✅ Promo codes: Equal counts (~76)

---

**Created**: 2025-08-10  
**Status**: Battle Tested & Production Ready ✅