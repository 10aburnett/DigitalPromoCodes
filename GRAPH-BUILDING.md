# Graph Building & SEO Optimization System

## Overview

The graph building system creates SEO-optimized recommendation and alternative links between whops to eliminate orphan pages and distribute link equity effectively across the site.

## Key Components

### 1. Graph Generation Scripts

**Main Scripts:**
- `scripts/build-graph-chatgpt.ts` - **ChatGPT's SEO-optimized algorithm with explore slots** (RECOMMENDED)
- `scripts/build-graph-optimized.ts` - Alternative optimized version
- `scripts/build-graph.ts` - Original basic version

**Publishing Scripts:**
- `scripts/build-and-publish-graph-optimized.ts` - Builds and publishes graph to production

### 2. Generated Files

**Graph Data:**
- `public/data/graph/neighbors.json` - Main graph file with recommendations, alternatives, and explore links
- `public/data/graph/topics.json` - Topic categorization data
- `public/data/graph/inbound-counts.json` - Link distribution statistics

### 3. Frontend Components

**Components with Graph Integration:**
- `src/components/RecommendedWhops.tsx` - Shows recommendations + explore links
- `src/components/Alternatives.tsx` - Shows alternatives + explore links (if different from recommendations)
- `src/lib/graph.ts` - Graph data loading and helper functions

## SEO Strategy & Link Distribution

### ChatGPT's 5-Pass SEO Algorithm

The ChatGPT algorithm implements a sophisticated SEO optimization strategy:

1. **Diversity Constraints** - Prevents any single whop from dominating recommendation slots
2. **Hub Cap Limits** - Hard limit of 250 inbound links per whop to prevent mega-hubs
3. **Category Distribution** - Ensures recommendations span different categories
4. **Anti-Popularity Penalties** - Reduces over-recommendation of already popular whops
5. **Explore Slots** - One explore link per whop for orphan elimination

### Link Types

**Recommendations (4 per whop):**
- Primary discovery mechanism
- Higher similarity threshold (score ≥ 20)
- Stricter diversity constraints

**Alternatives (4-5 per whop):**
- Secondary discovery for different approaches
- Lower similarity threshold (score ≥ 0.1)
- More flexible diversity rules

**Explore Links (1 per whop):**
- **SEO orphan elimination** - Each whop gets exactly ONE explore link
- Targets whops that need more inbound links (minimum 2-3 inbound required)
- Less restrictive matching criteria to maximize coverage
- **Single explore link per whop is sufficient for SEO** according to ChatGPT

## Current Statistics

**Active Graph Data (as of last build):**
- **4,368 explore links** - Eliminates orphan pages
- **~8,200 total whops** in system
- **Hub cap: 250** max inbound links per whop
- **Diversity: High** - No single whop dominates recommendation slots

## How Explore Links Work

### Backend (Graph Generation)
1. Algorithm identifies whops with insufficient inbound links
2. Creates one explore slot per whop: `{ s: whopSlug, type: 'x' }`
3. Assigns explore targets using greedy algorithm to meet minimum inbound requirements
4. Stores in graph as: `"whop-slug": { "explore": "target-slug" }`

### Frontend (Component Rendering)
1. `getExploreFor()` fetches explore target from graph data
2. `fetchWhopDetails()` hydrates target with full whop data (name, category, etc.)
3. Duplicate prevention: Skip if explore target already shown in recommendations/alternatives
4. Renders as: `"Explore another in {Category}: {Name} →"`

### SEO Benefits
- **Link Equity Distribution** - Spreads PageRank-style authority across site
- **Crawlability** - Ensures all pages reachable from any entry point
- **Long-tail Discovery** - Helps users find less popular but relevant whops
- **Orphan Prevention** - Guarantees minimum inbound links for every whop

## Rebuilding the Graph

### When to Rebuild
- **New whops added** to database
- **Major category changes** in existing whops
- **SEO performance issues** detected
- **Algorithm improvements** implemented

### How to Rebuild

1. **Use ChatGPT Script (Recommended):**
   ```bash
   npx ts-node scripts/build-graph-chatgpt.ts
   ```

2. **Alternative Optimized Script:**
   ```bash
   npx ts-node scripts/build-graph-optimized.ts
   ```

3. **Build and Publish (Production):**
   ```bash
   npx ts-node scripts/build-and-publish-graph-optimized.ts
   ```

### ⚠️ CRITICAL: Update Version After Rebuild

**Every time you rebuild the graph, you MUST:**

1. **Commit the new graph file:**
   ```bash
   git add public/data/graph/neighbors.json
   git commit -m "chore: update graph with new whops/algorithm"
   git push
   ```

2. **Update Vercel environment variable:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Update `NEXT_PUBLIC_GRAPH_VERSION` to new value (e.g., `2024-09-24-abc1234`)
   - Use format: `YYYY-MM-DD-<git-commit-sha>`

3. **Redeploy production:**
   - Vercel will auto-deploy when you push, OR
   - Manually trigger deployment in Vercel dashboard

**Why this is required:**
- `NEXT_PUBLIC_GRAPH_VERSION` is your **cache buster**
- Without bumping it, browsers/CDNs serve old cached graph data
- Production will show outdated recommendations/alternatives
- **Rule: New graph data = Bump version string**

### Quick Reference Commands

```bash
# 1. Rebuild graph
npx ts-node scripts/build-graph-chatgpt.ts

# 2. Get commit SHA for version
git log --oneline -1

# 3. Commit new graph
git add public/data/graph/neighbors.json
git commit -m "chore: rebuild graph $(date +%Y-%m-%d)"
git push

# 4. Update Vercel env var
# NEXT_PUBLIC_GRAPH_VERSION=2024-09-24-<new-commit-sha>

# 5. Verify on production
# Check window.__graphDebug.version in browser DevTools
```

### Environment Variables

**For Graph Building:**
- `DATABASE_URL` - Database connection for whop data
- `PRODUCTION_DATABASE_URL` - Production database for final builds

**For Frontend:**
- `NEXT_PUBLIC_USE_GRAPH_LINKS=true` - Enable graph-based links over API
- `NEXT_PUBLIC_GRAPH_URL` - Custom graph file location (optional)
- `NEXT_PUBLIC_GRAPH_VERSION` - Cache busting version (optional)

## Production/Localhost Parity Configuration

To ensure production and localhost show identical recommendations and alternatives, set these Vercel environment variables:

### Required Production Environment Variables

```bash
# Lock prod to graph-only mode (no API divergence)
NEXT_PUBLIC_USE_GRAPH_LINKS=true

# Point to canonical graph URL (update when publishing new graph)
NEXT_PUBLIC_GRAPH_URL=/data/graph/neighbors.json
# OR for external CDN: https://your-cdn.com/graph/neighbors-latest.json

# Cache busting version (update whenever you publish new graph)
NEXT_PUBLIC_GRAPH_VERSION=2024-01-15-abc123f

# Optional: Disable API fallback for perfect parity testing
NEXT_PUBLIC_DISABLE_API_FALLBACK=true
```

### How It Works

1. **Canonical URL**: `NEXT_PUBLIC_GRAPH_URL` forces prod to use exact same graph file as local
2. **Cache Busting**: `NEXT_PUBLIC_GRAPH_VERSION` prevents CDN/Vercel edge caching old graph
3. **Graph Priority**: `NEXT_PUBLIC_USE_GRAPH_LINKS=true` ensures graph is tried first
4. **API Disable**: `NEXT_PUBLIC_DISABLE_API_FALLBACK=true` prevents fallback to different DB

### Verification Steps

**Check graph URL in production:**
```javascript
// In browser DevTools on prod page
console.log('Graph URL:', window.__WHOP_GRAPH_URL);
console.log('Graph debug:', window.__graphDebug);
```

**Verify data source:**
```javascript
// Check what source was used for recommendations
console.log('Rec debug:', window.__whpRecDebug);
console.log('Alt debug:', window.__whpAltDebug);

// Should show source: "graph+batch" on both prod and local
```

**Hash comparison (bulletproof verification):**
```bash
# Local hash
shasum -a 256 public/data/graph/neighbors.json

# Production hash (replace with your actual env vars)
curl -sL "$NEXT_PUBLIC_GRAPH_URL?v=$NEXT_PUBLIC_GRAPH_VERSION" | shasum -a 256

# Hashes should match exactly
```

## Quality Assurance

### Validation Checks
- **Minimum inbound links** - Every whop has ≥2 inbound links
- **Hub limits** - No whop exceeds 250 inbound links
- **Orphan elimination** - All whops reachable from site navigation
- **Diversity metrics** - Recommendation distribution is balanced

### Debug Tools
- Browser console: `window.__whpRecDebug` - Recommendations debug data
- Browser console: `window.__whpAltDebug` - Alternatives debug data
- Browser console: `window.__graphDebug` - Graph loading debug data

## Important Notes

⚠️ **Single Explore Link is Sufficient**
- ChatGPT confirmed one explore link per whop meets SEO requirements
- No need to populate explore links in both Recommendations AND Alternatives
- Current system shows explore in Recommendations section only

⚠️ **Graph Rebuild Required**
- Adding new whops requires rebuilding graph to include them in link structure
- Graph data is static and doesn't auto-update when database changes

⚠️ **Production Safety**
- Always test graph builds on backup database first
- Use `PRODUCTION_DATABASE_URL` for final production builds
- Commit generated graph files to Git for consistency across environments

## 🚀 **CRITICAL FIXES IMPLEMENTED (2025-09)**

### **Problems Solved:**
1. **❌ Minimum Inbound Issue**: 768 pages had only 1 inbound link (target: ≥2)
2. **❌ Explore Collisions**: 1,160 explore links duplicated existing recs/alts
3. **❌ Poor Alt Diversity**: Only 23.7% unique alternative combinations (target: ≥80%)

### **Solutions Applied:**
- **Fix A**: Added `topUpInboundToTwo()` hard guarantee function
- **Fix B**: Implemented collision detection for explore assignments
- **Fix C**: Widened candidate pools, added seeded shuffle & global usage tracking

### **Technical Implementation:**
- **Enhanced ChatGPT script** with utility functions for graph analysis
- **Seedrandom integration** for deterministic but diverse builds
- **Smart slug validation** to handle edge cases and empty slugs
- **Strategic function placement** to run fixes before QA checks

---

## 🔍 **MANDATORY GRAPH VERIFICATION CHECKLIST**

**Run these commands EVERY TIME after building a new graph:**

### **1. Orphan & Hub Cap Check**
```bash
node -e "const g=require('./public/data/graph/neighbors.json');const i={};for(const [s,v] of Object.entries(g)){for(const t of new Set([...(v.recommendations||[]),...(v.alternatives||[]),...(v.explore?[v.explore]:[])])){i[t]=(i[t]||0)+1}};let z0=0,z1=0,m=0;for(const k of Object.keys(g)){const v=i[k]||0;m=Math.max(m,v);if(v<1)z0++;if(v===1)z1++;}console.log({zeroInbound:z0,oneInbound:z1,maxInbound:m});"
```
**✅ PASS Criteria:** `zeroInbound: 0`, `oneInbound: ≤10`, `maxInbound: ≤250`

### **2. Explore Collision Check**
```bash
node -e "const g=require('./public/data/graph/neighbors.json');let dup=0;for(const [s,v] of Object.entries(g)){const set=new Set([...(v.recommendations||[]),...(v.alternatives||[])]);if(v.explore && set.has(v.explore))dup++;}console.log({exploreCollisions:dup});"
```
**✅ PASS Criteria:** `exploreCollisions: 0`

### **3. Diversity Analysis**
```bash
node -e "const g=require('./public/data/graph/neighbors.json');const canon=(xs)=>JSON.stringify((xs||[]).filter(Boolean));const recCombos=new Set(), altCombos=new Set();for(const v of Object.values(g)){recCombos.add(canon(v.recommendations));altCombos.add(canon(v.alternatives));}const total=Object.keys(g).length;console.log({total,recUnique: recCombos.size, recDiversity: (recCombos.size/total*100).toFixed(1)+'%',altUnique: altCombos.size, altDiversity: (altCombos.size/total*100).toFixed(1)+'%'});"
```
**✅ PASS Criteria:** `recDiversity: ≥70%`, `altDiversity: ≥80%`

### **4. Sample Structure Check**
```bash
node -e "const g=require('./public/data/graph/neighbors.json');const sample='ayecon-academy-monthly-mentorship';console.log('Sample structure:', g[sample]);"
```
**✅ PASS Criteria:** Object has `recommendations`, `alternatives`, and `explore` properties

### **5. Frontend Integration Test**
```bash
curl -s "http://localhost:3001/data/graph/neighbors.json" | jq 'keys | length'
```
**✅ PASS Criteria:** Returns number matching total whops (currently ~5,865)

---

## 📋 **COMPLETE BUILD & DEPLOY WORKFLOW**

### **Step 1: Build New Graph**
```bash
npx ts-node scripts/build-graph-chatgpt.ts
```
**Expected output:** "✅ SEO-optimized graph with explore slots saved"

### **Step 2: Run Full Verification Suite**
Execute all 5 verification commands above. **ALL MUST PASS** before proceeding.

### **Step 3: Commit & Version**
```bash
git add public/data/graph/neighbors.json public/data/graph/inbound-counts.json public/data/graph/topics.json
git commit -m "chore: rebuild graph with SEO fixes $(date +%Y-%m-%d)"
git push
```

### **Step 4: Update Production Environment**
In Vercel Dashboard → Environment Variables:
```bash
NEXT_PUBLIC_GRAPH_VERSION=2025-09-25-$(git rev-parse --short HEAD)
```

### **Step 5: Redeploy & Verify Production**
- Trigger Vercel deployment
- Check production console: `window.__graphDebug.version`
- Spot-check sample whop page for explore links

---

## 🎯 **SUCCESS METRICS (Current Baseline)**

**Achieved with September 2025 fixes:**
- ✅ **Zero orphaned pages** (0% with <1 inbound)
- ✅ **Perfect explore collision elimination** (0 duplicates)
- ✅ **Excellent alternative diversity** (99.8% unique combinations)
- ✅ **Good recommendation diversity** (74.9% unique combinations)
- ✅ **Strict hub cap enforcement** (max 160, cap 250)
- ✅ **Minimal singletons** (10 pages with exactly 1 inbound)

**Graph Statistics:**
- Total whops: 5,865
- Total recommendations: 11,472
- Total alternatives: 23,460
- Total explore links: 2,555
- Average inbound per whop: 6.7

---

## ⚠️ **CRITICAL REMINDERS**

1. **NEVER deploy without running verification checklist**
2. **ALWAYS bump NEXT_PUBLIC_GRAPH_VERSION after new graph**
3. **MONITOR first 24h after deployment for crawl issues**
4. **Keep backup of previous working graph before major changes**
5. **Run verification on BOTH local and production environments**

---

## Future Improvements

**Potential Enhancements:**
- Real-time graph updates when whops added/modified
- A/B testing different explore link strategies
- Integration with analytics to optimize recommendation performance
- Automated graph rebuilding via GitHub Actions
- Advanced topic modeling for better similarity scoring