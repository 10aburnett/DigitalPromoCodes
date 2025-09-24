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

### Environment Variables

**For Graph Building:**
- `DATABASE_URL` - Database connection for whop data
- `PRODUCTION_DATABASE_URL` - Production database for final builds

**For Frontend:**
- `NEXT_PUBLIC_USE_GRAPH_LINKS=true` - Enable graph-based links over API
- `NEXT_PUBLIC_GRAPH_URL` - Custom graph file location (optional)
- `NEXT_PUBLIC_GRAPH_VERSION` - Cache busting version (optional)

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