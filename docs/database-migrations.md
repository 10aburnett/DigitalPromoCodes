# Database Migration Guide

## 🛡️ Safe Database Changes

To prevent data loss when making schema changes, always use Prisma migrations instead of `prisma db push`.

## 📝 How to Add New Features (Without Data Loss)

### 1. **Make Schema Changes**
Edit `prisma/schema.prisma` with your new fields/tables.

### 2. **Create Migration**
```bash
# Create migration file (don't apply yet)
npx prisma migrate dev --name your_feature_name

# This creates: prisma/migrations/[timestamp]_your_feature_name/
```

### 3. **Review Migration**
Check the generated SQL in the migration file to ensure it's safe.

### 4. **Apply to Production**
```bash
# Deploy to production database
npx prisma migrate deploy
```

## 🚀 Deployment Process

### Development/Testing:
```bash
npm run build:dev  # Builds without migrations
npm run dev        # Local development
```

### Production Deployment:
```bash
npm run build      # Runs migrations first, then builds
```

## ⚠️ NEVER Use These Commands in Production:
- `prisma db push --force-reset` (deletes all data)
- `prisma migrate reset` (deletes all data)

## ✅ Safe Commands:
- `prisma migrate dev --name feature_name` (development)
- `prisma migrate deploy` (production)
- `prisma generate` (updates client)

## 📊 Current Schema Includes:
- ✅ Comment voting system (upvotes/downvotes)
- ✅ Nested comment replies (parent/child relationships)
- ✅ IP-based vote tracking
- ✅ All existing blog, user, and whop functionality

## 🔍 Migration History:
- `20240101000000_initial_schema` - Full schema with voting system