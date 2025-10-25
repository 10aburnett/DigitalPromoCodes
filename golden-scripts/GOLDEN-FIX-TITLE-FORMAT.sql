/**
 * 🏆 GOLDEN FIX TITLE FORMAT
 * Repairs promo code titles that are missing "% Off" or have incorrect format
 * Examples of issues fixed:
 *   "15 Dodgy's Dungeon" → "15% Off Dodgy's Dungeon"
 *   "35 Ayecon Academy Monthly" → "35% Off Ayecon Academy Monthly"
 *   "5 Best Of Both Worlds" → "5% Off Best Of Both Worlds"
 */

BEGIN;

-- ============================================================================
-- STEP A: Fix titles that start with bare number (e.g., "15 Dodgy's...")
--         Extract percentage from description and rebuild title
-- ============================================================================

-- A1) Preview what will be fixed
SELECT
  p.id,
  p.title AS before,
  w.name AS whop_name,
  p.description,
  p.value,
  trim(both ' ' FROM (
    COALESCE(
      substring(p.description from '(?i)([0-9]+(?:\.[0-9]+)?)\s*%\s*off'),
      substring(p.value       from '(?i)([0-9]+(?:\.[0-9]+)?)\s*%(?:\s*Off)?')
    ) || '% Off ' || w.name
  )) AS after
FROM "PromoCode" p
JOIN "Whop" w ON w.id = p."whopId"
WHERE p.title ~ '^\s*\d+(\.\d+)?\s'
  AND (
    p.description ~* '(\d+)\s*%\s*off'
    OR p.value ~* '(\d+)\s*%(\s*Off)?'
  )
LIMIT 25;

-- A2) Apply the fix (with fallback from description to value)
UPDATE "PromoCode" p
SET title = (
  SELECT trim(both ' ' FROM (
    COALESCE(
      substring(p.description from '(?i)([0-9]+(?:\.[0-9]+)?)\s*%\s*off'),
      substring(p.value       from '(?i)([0-9]+(?:\.[0-9]+)?)\s*%(?:\s*Off)?')
    ) || '% Off ' || w.name
  ))
  FROM "Whop" w
  WHERE w.id = p."whopId"
),
"updatedAt" = now()
WHERE p.title ~ '^\s*\d+(\.\d+)?\s'
  AND (
    p.description ~* '(\d+)\s*%\s*off'
    OR p.value ~* '(\d+)\s*%(\s*Off)?'
  );

-- ============================================================================
-- STEP B: Rebuild any remaining non-standard titles from value + whop name
--         Ensures all titles follow proper format patterns
-- ============================================================================

-- B1) Preview candidates that don't match expected format
SELECT
  p.id,
  p.title AS before,
  p.value,
  w.name AS whop_name,
  CASE
    WHEN p.value ~* '^\s*\d+(\.\d+)?\s*%(\s+Off)?\s*$'
      THEN regexp_replace(p.value, '\s*Off\s*$', '', 'i') || ' Off ' || w.name
    WHEN p.value ~ '^\s*\d+(\.\d+)?\s*$'
     AND (substring(p.value from '^\s*([0-9]+(?:\.[0-9]+)?)\s*$'))::numeric <= 100
      THEN (substring(p.value from '^\s*([0-9]+(?:\.[0-9]+)?)\s*$')) || '% Off ' || w.name
    WHEN p.value ~* '^\s*\$'
      THEN p.value || ' ' || w.name
    WHEN coalesce(nullif(p.value,''), '') <> ''
      THEN p.value || ' ' || w.name
    ELSE 'Discount on ' || w.name
  END AS after
FROM "PromoCode" p
JOIN "Whop" w ON w.id = p."whopId"
WHERE NOT (
  p.title ~* '^\s*\d+%\s+Off\b'
  OR p.title ~* '^\s*\$'
  OR p.title ~* '^\s*Discount\b'
)
LIMIT 25;

-- B2) Apply the rebuild
UPDATE "PromoCode" p
SET title = trim(both ' ' FROM
  CASE
    -- value looks like "10% Off" or "10%"
    WHEN p.value ~* '^\s*\d+(\.\d+)?\s*%(\s+Off)?\s*$'
      THEN regexp_replace(p.value, '\s*Off\s*$', '', 'i') || ' Off ' || w.name
    -- value is just a number ≤100 (e.g. "10", "25") - assume it's a percentage
    WHEN p.value ~ '^\s*\d+(\.\d+)?\s*$'
     AND (substring(p.value from '^\s*([0-9]+(?:\.[0-9]+)?)\s*$'))::numeric <= 100
      THEN (substring(p.value from '^\s*([0-9]+(?:\.[0-9]+)?)\s*$')) || '% Off ' || w.name
    -- value looks like a price e.g. "$200.00 / month"
    WHEN p.value ~* '^\s*\$'
      THEN p.value || ' ' || w.name
    -- fallback for any other value pattern
    WHEN coalesce(nullif(p.value,''), '') <> '' THEN p.value || ' ' || w.name
    ELSE 'Discount on ' || w.name
  END
),
"updatedAt" = now()
FROM "Whop" w
WHERE w.id = p."whopId"
  AND NOT (
    p.title ~* '^\s*\d+%\s+Off\b'
    OR p.title ~* '^\s*\$'
    OR p.title ~* '^\s*Discount\b'
  );

-- ============================================================================
-- STEP C: Final cleanup - normalize whitespace and scrub any stray tokens
-- ============================================================================

-- C1) Normalize separators and whitespace
UPDATE "PromoCode"
SET title = trim(both ' ' FROM
      regexp_replace(
        regexp_replace(
          regexp_replace(title, '\s*([–—\-:;])\s*', ' \1 ', 'g'),
          '\s{2,}', ' ', 'g'
        ),
        '^[–—\-:;,.!\s]+|[–—\-:;,.!\s]+$', '', 'g'
      )
    ),
    "updatedAt" = now()
WHERE title ~ '\s{2,}|^\s|[–—\-:;]';

-- C2) Remove any literal promo code tokens from titles
UPDATE "PromoCode"
SET title = trim(both ' ' FROM regexp_replace(title, '\mpromo-[a-z0-9_]+', '', 'gi')),
    "updatedAt" = now()
WHERE title ~* '\mpromo-[a-z0-9_]+';

-- ============================================================================
-- VERIFICATION: Count titles by format type
-- ============================================================================

SELECT
  COUNT(*) FILTER (WHERE title ~* '^\d+%\s+Off\b') as percent_off_titles,
  COUNT(*) FILTER (WHERE title ~* '^\$')            as price_titles,
  COUNT(*) FILTER (WHERE title ~* '^Discount\b')    as discount_titles,
  COUNT(*) FILTER (WHERE title ~* '\mpromo-[a-z0-9_]+') as leaked_tokens,
  COUNT(*) FILTER (WHERE title ~ '^\s*\d+(\.\d+)?\s+[A-Z]') as malformed_bare_number,
  COUNT(*) as total
FROM "PromoCode";

-- Show sample of fixed titles
SELECT id, title, value, "updatedAt"
FROM "PromoCode"
ORDER BY "updatedAt" DESC
LIMIT 20;

\if :dryrun
\echo '🧪 DRY-RUN MODE: Rolling back all changes...'
ROLLBACK;
\else
\echo '✅ LIVE MODE: Committing all changes...'
COMMIT;
\endif

-- ============================================================================
-- POST-RUN VERIFICATION QUERIES
-- ============================================================================

-- Check for any remaining malformed titles (bare number followed by name)
-- SELECT id, title, value, description
-- FROM "PromoCode"
-- WHERE title ~ '^\s*\d+(\.\d+)?\s+[A-Z]'
-- ORDER BY title;

-- Check all titles are properly formatted
-- SELECT
--   CASE
--     WHEN title ~* '^\d+%\s+Off\b' THEN 'Percent Off'
--     WHEN title ~* '^\$' THEN 'Price'
--     WHEN title ~* '^Discount\b' THEN 'Discount'
--     ELSE 'Other'
--   END AS format_type,
--   COUNT(*) as count
-- FROM "PromoCode"
-- GROUP BY format_type
-- ORDER BY count DESC;
