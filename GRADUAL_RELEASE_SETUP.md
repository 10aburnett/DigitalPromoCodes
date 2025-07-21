# Gradual Release System Setup

## Overview
This system gradually releases 250 whop promo codes per day to avoid overwhelming Google and ensure SEO-friendly indexing.

## Setup Instructions

### 1. Database Migration
Run the database migration to add the `publishedAt` field:
```bash
npx prisma migrate deploy
```

### 2. Environment Variables
Add to your Vercel environment variables:
```bash
CRON_SECRET="your-secure-random-string"
```

### 3. Initial State
- All existing whops will have `publishedAt = null` (unpublished)
- Only whops with `publishedAt != null` will be visible on the site
- Admin panel shows all whops regardless of publication status

### 4. Automatic Publishing
- **Schedule**: Daily at 9:30 PM UTC
- **Batch Size**: 250 whops per day
- **Order**: Oldest whops first (by `createdAt`)
- **Endpoint**: `/api/cron/publish-whops`

### 5. Manual Management
Visit `/admin/publishing` to:
- View publication status
- Manually publish whops (unpublish functionality disabled for security)
- Monitor progress

## How It Works

### Frontend Filtering
```typescript
// Only show published whops (unless admin)
const whereClause = {
  publishedAt: isAdmin ? undefined : { not: null }
};
```

### Cron Job Logic
1. Find 250 oldest unpublished whops
2. Set their `publishedAt` to current date
3. Return status with remaining count

### Timeline
- **8,200 whops** ÷ **250 per day** = **~33 days** for full rollout
- Gradual indexing prevents Google penalties
- SEO-friendly content release schedule

## Manual Commands

### Publish 250 Whops
```bash
curl -X POST https://yoursite.com/api/admin/publish-whops \
  -H "Content-Type: application/json" \
  -d '{"action": "publish", "count": 250}'
```

### Check Status
```bash
curl -X POST https://yoursite.com/api/admin/publish-whops \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'
```

### Unpublish (DISABLED)
```bash
# SECURITY: Unpublish functionality has been disabled to prevent accidental mass unpublishing
# curl -X POST https://yoursite.com/api/admin/publish-whops \
#   -H "Content-Type: application/json" \
#   -d '{"action": "unpublish", "count": 250}'
```

## Security
- Cron endpoint protected by `CRON_SECRET`
- Admin endpoints require admin authentication
- Published status only affects public visibility

## Benefits
✅ **SEO Safe** - Gradual indexing prevents spam detection  
✅ **Controllable** - Can pause, resume, or adjust schedule  
⚠️  **One-way only** - Unpublish functionality disabled to prevent accidental mass unpublishing  
✅ **Automatic** - No manual intervention required  
✅ **Secure** - Protected endpoints and admin-only access