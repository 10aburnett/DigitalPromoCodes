# 🌍 Schema Locale Feature Activation Guide

## Current Status: DISABLED (Safe)
The locale-aware schema markup feature is currently **OFF** and your site functions exactly as before.

## When You're Ready to Activate

### 1. Fix Your Existing i18n System First
- Resolve the language switching issues in your current i18n implementation
- Ensure whops display correctly when changing languages
- Test that all locale routes work properly

### 2. Enable the Feature Flag

**In Production (Vercel):**
```bash
# Add this environment variable in Vercel dashboard:
SCHEMA_LOCALE_ENABLED=true
```

**For Local Testing:**
```bash
# Add to your .env.local file:
SCHEMA_LOCALE_ENABLED=true
```

### 3. What Happens When Activated

✅ **Schema Changes:**
- JSON-LD `inLanguage` field matches page locale (e.g., "de", "sk")
- Per-locale `@id` URLs (e.g., `https://whpcodes.com/de/whop/slug#product`)
- Canonical URLs include locale paths
- hreflang tags for all configured locales

✅ **SEO Benefits:**
- Google understands content language
- Proper international targeting
- Better search rankings in local markets

### 4. Supported Locales
Currently configured for: `en`, `de`, `sk`

To add more locales, edit `src/lib/schema-locale.ts`:
```typescript
export const LOCALES = ['en', 'de', 'sk', 'fr', 'es'] as const;
```

### 5. Testing Checklist

**Before Activation:**
- [ ] i18n system works correctly
- [ ] Language switching displays proper whops
- [ ] All locale routes return valid content

**After Activation:**
- [ ] View source shows correct `inLanguage` values
- [ ] hreflang tags present in `<head>`
- [ ] Schema `@id` uses locale-specific URLs
- [ ] Canonical URLs match page locale

### 6. Rollback Plan
If issues occur, simply set `SCHEMA_LOCALE_ENABLED=false` and redeploy. The site will immediately return to current behavior.

---

## Implementation Details

**Files Modified for Locale Support:**
- `src/lib/schema-locale.ts` - Feature flag and locale config
- `src/lib/urls.ts` - Locale-aware URL generation
- `src/app/(public)/whop/[slug]/vm.ts` - Locale parameter support
- `src/app/(public)/whop/[slug]/page.tsx` - hreflang metadata

**Safety Features:**
- Zero functionality changes when disabled
- No new database queries
- Doesn't interfere with existing i18n system
- SSR-only implementation

---

*Last Updated: September 26, 2025*
*Status: Ready for activation when i18n system is stable*