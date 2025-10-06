# Sitemap Regeneration Guide

## Overview

The sitemap system uses **sharded sitemaps** with **cache tagging** for efficient updates. When you change a whop's indexing status or add new whops, you have three options for regenerating sitemaps.

## Current Sitemap Structure

- **Main Index**: `/sitemap.xml` → References all shards
- **Shards**:
  - `/sitemap/hubs.xml` → 6 static hub pages (home, blog, about, contact, privacy, terms)
  - `/sitemap/whops-a-f.xml` → Whops with slugs starting A-F
  - `/sitemap/whops-g-m.xml` → Whops with slugs starting G-M
  - `/sitemap/whops-n-s.xml` → Whops with slugs starting N-S
  - `/sitemap/whops-t-z.xml` → Whops with slugs starting T-Z

## Quality Gates

All sitemap shards automatically apply quality gates via `whereIndexable()`:
- ✅ Only includes whops with `indexingStatus` in `['INDEX', 'INDEXED']`
- ✅ Excludes whops with `retirement === 'GONE'`
- ✅ Excludes whops with `retired === true`

## Three Ways to Regenerate Sitemaps

### 1. ⏰ Automatic Time-Based (Every 1 Hour)

**How it works**: Each sitemap shard has `revalidate: 3600` (1 hour cache). After 1 hour, the first visitor triggers a background rebuild.

**When to use**: For non-urgent updates or regular maintenance.

**Action required**: None - happens automatically.

---

### 2. ⚡ On-Demand Revalidation via API (Instant - **Recommended**)

**How it works**: Call the `/api/revalidate` endpoint with cache tags to instantly regenerate specific sitemaps.

**When to use**:
- After changing a whop's indexing status in admin
- After adding new whops
- After bulk updates to whop visibility

**Examples**:

#### Refresh ALL sitemaps
```bash
curl -X POST https://whpcodes.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: YOUR_SECRET_HERE" \
  -d '{"tags":["sitemaps"]}'
```

#### Refresh just ONE shard (faster for single whop updates)
```bash
# If you updated a whop with slug starting "a-f"
curl -X POST https://whpcodes.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: YOUR_SECRET_HERE" \
  -d '{"tags":["sitemap:a-f"]}'

# For slugs starting "g-m"
curl -X POST https://whpcodes.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: YOUR_SECRET_HERE" \
  -d '{"tags":["sitemap:g-m"]}'
```

#### Refresh just hubs sitemap
```bash
curl -X POST https://whpcodes.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: YOUR_SECRET_HERE" \
  -d '{"tags":["sitemap:hubs"]}'
```

**Available cache tags**:
- `sitemaps` → All sitemap shards (hubs + all whop ranges)
- `sitemap:hubs` → Just the hubs sitemap
- `sitemap:a-f` → Just the A-F whop shard
- `sitemap:g-m` → Just the G-M whop shard
- `sitemap:n-s` → Just the N-S whop shard
- `sitemap:t-z` → Just the T-Z whop shard

**Secret**: The `REVALIDATE_SECRET` is stored in `.env.local`:
```bash
REVALIDATE_SECRET=Wr/lWwPK3KqjKQKpfHmlvtepsF5G8rKxU/4qfL8DKV0=
```

**Local testing**:
```bash
curl -X POST http://localhost:3000/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: Wr/lWwPK3KqjKQKpfHmlvtepsF5G8rKxU/4qfL8DKV0=" \
  -d '{"tags":["sitemaps"]}'
```

---

### 3. 🔨 Full Rebuild (Most Thorough)

**How it works**: Completely rebuilds all static content including sitemaps.

**When to use**:
- Major schema changes
- After database migrations
- When troubleshooting sitemap issues
- Before deploying to production

**Commands**:
```bash
# Rebuild everything
npm run build

# Then restart server (development)
npm run dev

# Or production
npm run start
```

---

## Recommended Workflow: Auto-Revalidate in Admin

To make sitemap updates seamless, add automatic revalidation to your admin whop update handler:

### Example: Add to Admin Whop Update Handler

```typescript
// In your admin API route that updates whop indexing status
// e.g., src/app/api/admin/whops/[id]/route.ts

import { revalidateTag } from 'next/cache';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // ... your existing update logic ...

  const updated = await prisma.whop.update({
    where: { id: params.id },
    data: {
      indexingStatus: newStatus,
      // ... other fields
    }
  });

  // ✅ Automatically revalidate the appropriate sitemap shard
  const firstLetter = updated.slug[0].toLowerCase();
  let tag = 'sitemaps'; // Default: refresh all

  if (firstLetter >= 'a' && firstLetter <= 'f') tag = 'sitemap:a-f';
  else if (firstLetter >= 'g' && firstLetter <= 'm') tag = 'sitemap:g-m';
  else if (firstLetter >= 'n' && firstLetter <= 's') tag = 'sitemap:n-s';
  else if (firstLetter >= 't' && firstLetter <= 'z') tag = 'sitemap:t-z';

  revalidateTag(tag); // Server-side revalidation

  return NextResponse.json({ ok: true });
}
```

**Benefits**:
- ✅ Sitemaps update instantly when you change indexing status
- ✅ No manual API calls needed
- ✅ Only revalidates the affected shard (faster)
- ✅ Works seamlessly with your admin workflow

---

## Verification

After regenerating sitemaps, verify they're working:

```bash
# Check sitemap index
curl https://whpcodes.com/sitemap.xml

# Check individual shards
curl https://whpcodes.com/sitemap/whops-a-f.xml
curl https://whpcodes.com/sitemap/whops-g-m.xml
curl https://whpcodes.com/sitemap/whops-n-s.xml
curl https://whpcodes.com/sitemap/whops-t-z.xml
curl https://whpcodes.com/sitemap/hubs.xml

# Count entries in each shard
curl -s https://whpcodes.com/sitemap/whops-a-f.xml | grep -c '<loc>'
```

**Expected counts** (as of Oct 2025):
- A-F: 15 whops
- G-M: 18 whops
- N-S: 15 whops
- T-Z: 22 whops
- Hubs: 6 pages
- **Total**: 70 indexable whops + 6 hub pages

---

## Troubleshooting

### Sitemaps show old data after revalidation
1. Check that `DEBUG_CACHE=1` is set in `.env.local`
2. Look for `[SITEMAP]` logs in server output
3. Verify the correct cache tag was used
4. Try refreshing with the `sitemaps` tag (all shards)

### Whop not appearing in sitemap after indexing status change
1. Verify whop has `indexingStatus` = `'INDEX'` or `'INDEXED'`
2. Verify whop is NOT `retired` and does NOT have `retirement = 'GONE'`
3. Check the whop is in the correct alphabetical shard
4. Run on-demand revalidation for that shard
5. Check server logs for `[SITEMAP] Generated X entries` messages

### Need to see cache behavior
Enable debug mode in `.env.local`:
```bash
DEBUG_CACHE=1
```

Then watch server logs when accessing sitemaps - you'll see cache HIT/MISS messages.

---

## Related Files

- **Sitemap utilities**: `src/lib/sitemap-utils.ts`
- **Sitemap index**: `src/app/sitemap.xml/route.ts`
- **Sitemap shards**: `src/app/sitemap/*.xml/route.ts`
- **Revalidation API**: `src/app/api/revalidate/route.ts`
- **Quality gates**: `src/lib/where-indexable.ts`

---

## Summary

| Method | Speed | Use Case |
|--------|-------|----------|
| **Automatic (1hr)** | Slow | Regular maintenance, non-urgent |
| **On-Demand API** ⭐ | Instant | After admin changes, recommended |
| **Full Rebuild** | Slow | Major changes, troubleshooting |

**🎯 Best Practice**: Add automatic `revalidateTag()` calls to your admin update handlers for seamless sitemap updates.
