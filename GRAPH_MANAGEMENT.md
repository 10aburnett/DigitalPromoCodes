# Graph Management Guide

## 🎯 Overview

The site recommendation system uses a pre-computed graph stored in `public/data/graph/neighbors.json`. This guide explains how to safely rebuild and update the graph when adding new whops or improving recommendations.

## 🏗️ Current Architecture

- **Graph Location**: `public/data/graph/neighbors.json` (committed to repo)
- **Vercel Behavior**: Uses committed file, does NOT rebuild during deployment
- **Safety**: Vercel's `prebuild` no longer includes `npm run build:graph`
- **Fallbacks**: Client has graph → API → graph-only cards safety net

## 📋 When to Rebuild Graph

### Required Rebuilds
- ✅ New whops added to database
- ✅ Whop data significantly changed (titles, categories, etc.)
- ✅ Algorithm improvements in `scripts/build-graph.ts`
- ✅ Graph appears stale or missing recommendations

### Optional Rebuilds
- 🟡 Minor promo code updates (graph can stay same)
- 🟡 UI/styling changes (no graph rebuild needed)

## 🔧 How to Rebuild Graph (Step-by-Step)

### Option 1: Safe Local Rebuild (Recommended)

```bash
# 1. Switch to production database (read-only)
node scripts/set-env-from-branch.js --force-production

# 2. Rebuild graph from production data
npx tsx scripts/build-graph.ts

# 3. Verify the output
node -e "
const g = require('./public/data/graph/neighbors.json');
console.log('Total keys:', Object.keys(g).length);
console.log('website-master recs:', g['website-master']?.recommendations?.length || 0);
console.log('Sample entry:', JSON.stringify(g['website-master'], null, 2));
"

# 4. Commit and deploy
git add public/data/graph/
git commit -m "feat: rebuild graph with latest whop data

- Updated neighbors.json with X new whops
- Fixed Y recommendation gaps
- Graph now contains Z total entries

🤖 Generated with [Claude Code](https://claude.ai/code)"

git push origin development
# (Will auto-merge to main via your workflow)

# 5. Switch back to backup for local dev
node scripts/set-env-from-branch.js --force-backup
```

### Option 2: One-Time Vercel Rebuild

```bash
# Temporarily enable graph rebuild on Vercel
# In Vercel → Project → Settings → Build & Development:
# Build Command: npm run prebuild:with-graph && npm run build

# Deploy once, then change back to: npm run build
```

## 🛡️ Safety Checklist

### Before Rebuilding
- [ ] Confirm `scripts/build-graph.ts` is read-only (no INSERT/UPDATE/DELETE)
- [ ] Database has recent data (new whops are active)
- [ ] Backup current graph: `cp public/data/graph/neighbors.json neighbors.backup.json`

### After Rebuilding
- [ ] Verify key whops have recommendations: `jq '.["website-master"].recommendations' public/data/graph/neighbors.json`
- [ ] Check total entries: `jq 'keys | length' public/data/graph/neighbors.json`
- [ ] Test locally: Visit `/whop/website-master` and see recommendations
- [ ] Confirm no empty arrays: `jq 'to_entries | map(select(.value.recommendations == [])) | length' public/data/graph/neighbors.json`

### Production Verification
```bash
# Graph file accessible
curl -s https://whpcodes.com/data/graph/neighbors.json | jq 'keys | length'

# Test slug has recommendations
curl -s https://whpcodes.com/data/graph/neighbors.json | jq '.["website-master"].recommendations'

# Batch API works
SLUGS="$(curl -s https://whpcodes.com/data/graph/neighbors.json | jq -r '.["website-master"].recommendations | map(@uri) | join(",")')"
curl -s "https://whpcodes.com/api/whops/batch?slugs=${SLUGS}" | jq '.whops | length'
```

## 🚫 Critical: What NOT to Do

### ❌ NEVER Do These
```bash
# DON'T: Add build:graph back to prebuild
"prebuild": "... && npm run build:graph"  # ❌ Will overwrite commits

# DON'T: Use force commands on production DB
npx prisma db push --force-reset  # ❌ Data loss risk

# DON'T: Run graph build against backup DB in production
# (Use production DB for prod graph builds)
```

### ⚠️ Dangerous Operations
- Editing graph JSON manually (use build script instead)
- Running graph build without verifying database connection
- Committing graph built from wrong database
- Changing prebuild command in Vercel permanently

## 🔄 Rollback Procedure

If graph update breaks recommendations:

```bash
# 1. Restore previous graph
git show HEAD~1:public/data/graph/neighbors.json > public/data/graph/neighbors.json

# 2. Commit rollback
git add public/data/graph/neighbors.json
git commit -m "fix: rollback graph to previous working state"
git push origin development

# 3. Investigate issue
# - Check database for missing whops
# - Review build script changes
# - Test graph build locally first
```

## 📊 Graph Statistics & Monitoring

### Healthy Graph Indicators
- **Total entries**: ~5,000-6,000 (matches active whops)
- **Avg recommendations per whop**: 3-5
- **Orphan whops**: <100 (whops with 0 inbound links)
- **Build time**: 5-15 minutes

### Red Flags
- 🔴 Total entries dropped significantly
- 🔴 Many whops have empty recommendations `[]`
- 🔴 Build fails with database errors
- 🔴 Graph file >10MB (data explosion)

## 🤖 Future Improvements

### Automation Ideas
- **GitHub Action**: Weekly graph rebuild + commit
- **Database trigger**: Auto-rebuild when new whops added
- **Health check**: Monitor recommendation coverage
- **A/B testing**: Compare graph vs API performance

### Code Organization
- `scripts/build-graph.ts` - Main build logic
- `src/lib/graph.ts` - Client-side graph loading
- `src/lib/topics.ts` - Similarity algorithms
- `public/data/graph/` - Generated graph files

## 📞 Troubleshooting

### "No recommendations showing"
1. Check graph file exists: `curl https://whpcodes.com/data/graph/neighbors.json`
2. Verify environment variables: `NEXT_PUBLIC_USE_GRAPH_LINKS=true`
3. Check browser console for debug logs
4. Test batch API manually

### "Graph build fails"
1. Verify database connection in `.env.local`
2. Check production DB is accessible
3. Review script logs for specific errors
4. Ensure all dependencies installed: `npm install`

### "Vercel overwriting graph"
1. Confirm `prebuild` doesn't include `build:graph`
2. Check Vercel build command is just `npm run build`
3. Verify graph files are committed to repo

---

## ✅ Quick Reference Commands

```bash
# Rebuild graph locally
node scripts/set-env-from-branch.js --force-production && npx tsx scripts/build-graph.ts

# Check graph health
jq 'to_entries | map(select(.value.recommendations | length > 0)) | length' public/data/graph/neighbors.json

# Test production graph
curl -s https://whpcodes.com/data/graph/neighbors.json | jq '.["website-master"].recommendations'

# Deploy graph updates
git add public/data/graph/ && git commit -m "feat: update graph" && git push origin development
```

**Last Updated**: September 2025
**Next Review**: When major whop additions occur