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

## Future Improvements

**Potential Enhancements:**
- Real-time graph updates when whops added/modified
- A/B testing different explore link strategies
- Integration with analytics to optimize recommendation performance
- Automated graph rebuilding via GitHub Actions
- Advanced topic modeling for better similarity scoring