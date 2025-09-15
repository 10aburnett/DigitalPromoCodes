# 🏆 WORKING GOLDEN SCRIPTS REMINDER

## The 5 Scripts That Work (Run These When Asked)

When user asks to "run the golden scripts", run these 5 in order:

1. **GOLDEN-CONTENT-SYNC-BULLETPROOF.js**
   - Syncs Whop content fields between databases
   - Status: ✅ Working perfectly

2. **GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-2-WHOPS-PROMOCODES.js**
   - Syncs Whops and PromoCode tables
   - Status: ✅ Working perfectly

3. **GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-3-PROMO-SUBMISSIONS.js**
   - Syncs PromoCodeSubmissions table
   - Status: ✅ Fixed and working (authentication + schema fixes)

4. **GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER-NUMBER-4-REMAINING-TABLES.js**
   - Syncs remaining tables (BulkImport, ContactSubmission, LegalPage, OfferTracking, Reviews, Settings)
   - Status: ✅ Fixed and working (delegate names + raw SQL for OfferTracking)

5. **GOLDEN-COMMENTS-SYNC-SCRIPT-NO-DELETIONS-EVER.js**
   - Syncs Comment table
   - Status: ✅ Fixed and working (delegate casing + environment variables)

## Command Template:
```bash
cd /Users/alexburnett/Downloads/cryptobonusesnew\ copy\ 2/golden-scripts
node --env-file=../.env.sync [SCRIPT_NAME]
```

## Scripts to AVOID:
- Any with "original", "old", "broken" in the name
- GOLDEN-BIDIRECTIONAL-DATABASE-SYNC-SCRIPT-NO-DELETIONS-EVER.js (the main one has schema validation issues)

Last verified: 2025-09-15
All 5 scripts tested and working perfectly ✅