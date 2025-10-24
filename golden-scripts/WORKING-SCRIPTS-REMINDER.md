# 🏆 WORKING GOLDEN SCRIPTS REMINDER

## The 6 Scripts That Work (Run These When Asked)

When user asks to "run the golden scripts", run these 6 in order:

1. **GOLDEN-CONTENT-SYNC-BULLETPROOF.js**
   - Syncs Whop content fields between databases
   - Status: ✅ Working perfectly

2. **GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs** ⭐ NEW (Oct 2025)
   - Syncs PromoCode table using slug-based Whop resolution
   - Uses natural key (whopId, code) for safe upsert
   - Only updates when incoming discount is strictly better
   - Status: ✅ Battle tested and verified
   - **REPLACES**: Script #2's promo code sync (which used unsafe raw ID sync)

3. **GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js**
   - ⚠️ NOW ONLY syncs Whops table (not promo codes)
   - Use Script #2 (GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs) for promo codes instead
   - Status: ✅ Working perfectly for Whops

4. **GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-3-PROMO-SUBMISSIONS.js**
   - Syncs PromoCodeSubmissions table
   - Status: ✅ Fixed and working (authentication + schema fixes)

5. **GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-4-REMAINING-TABLES.js**
   - Syncs remaining tables (BulkImport, ContactSubmission, LegalPage, OfferTracking, Reviews, Settings)
   - Status: ✅ Fixed and working (delegate names + raw SQL for OfferTracking)

6. **GOLDEN-COMMENTS-SYNC-SCRIPT-NO-DELETIONS-EVER.js**
   - Syncs Comment table
   - Status: ✅ Fixed and working (delegate casing + environment variables)

## Command Template:
```bash
# For .js scripts (most of them)
cd /Users/alexburnett/Downloads/cryptobonusesnew\ copy\ 2/golden-scripts
node --env-file=../.env.sync [SCRIPT_NAME]

# For .mjs scripts (GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs)
cd /Users/alexburnett/Downloads/cryptobonusesnew\ copy\ 2
node golden-scripts/GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs
# (loads .env.sync automatically via dotenv config)
```

## Scripts to AVOID:
- Any with "original", "old", "broken" in the name
- GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER.js (the main one has schema validation issues)
- ⚠️ DO NOT use Script #2 for promo codes anymore - use GOLDEN-SAFE-PROMO-SYNC-BY-SLUG.mjs instead

Last verified: 2025-10-24
All 6 scripts tested and working perfectly ✅