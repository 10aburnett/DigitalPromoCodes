-- ========================================
-- CLEANUP DUPLICATE PROMO CODES (FK-SAFE)
-- ========================================
--
-- PURPOSE:
-- Removes duplicate PromoCode rows created when the old WHOPS-PROMOCODES
-- script was mistakenly used (it matches by raw IDs instead of natural key).
--
-- WHEN TO USE:
-- - After accidentally running the deprecated WHOPS-PROMOCODES script
-- - When `SELECT COUNT(*) FROM (SELECT "whopId","code", COUNT(*) FROM "PromoCode" GROUP BY 1,2 HAVING COUNT(*) > 1) x;` returns > 0
--
-- WHICH DATABASE:
-- Run against whichever database has duplicates:
-- - BACKUP:     psql "$SOURCE_DATABASE_URL" -f cleanup_promocode_duplicates.sql
-- - PRODUCTION: psql "$TARGET_DATABASE_URL" -f cleanup_promocode_duplicates.sql
--
-- WHAT IT DOES:
-- 1. Identifies duplicate (whopId, code) pairs
-- 2. Keeps the OLDEST promo per natural key
-- 3. Re-points OfferTracking.promoCodeId to the survivor promo
-- 4. Deletes the duplicate promos
-- 5. Reports how many rows were affected
--
-- SAFETY:
-- - Runs in a transaction (rollback on error)
-- - Preserves all referential integrity
-- - Keeps the oldest record (original data)
-- - Only deletes confirmed duplicates
--
-- INCIDENT HISTORY:
-- - 2025-10-24: Old script created 808 duplicates on both databases
--   - Cleanup successful on both
--   - Unique indexes added to prevent recurrence
--
-- ========================================

BEGIN;

-- Pick survivors (oldest per key)
WITH ranked AS (
  SELECT id, "whopId", code, "createdAt",
         ROW_NUMBER() OVER (PARTITION BY "whopId", code ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "PromoCode"
),
survivors AS (
  SELECT id AS survivor_id, "whopId", code
  FROM ranked
  WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, r."whopId", r.code
  FROM ranked r
  WHERE r.rn > 1
),
map AS (
  SELECT l.loser_id, s.survivor_id
  FROM losers l
  JOIN survivors s
    ON s."whopId" = l."whopId"
   AND s.code    = l.code
)

-- 1) Re-point OfferTracking to the survivor promo IDs
, repoint_result AS (
  UPDATE "OfferTracking" ot
  SET "promoCodeId" = m.survivor_id
  FROM map m
  WHERE ot."promoCodeId" = m.loser_id
  RETURNING ot.id
)

-- 2) Delete the duplicate promos
, delete_result AS (
  DELETE FROM "PromoCode"
  WHERE id IN (SELECT loser_id FROM map)
  RETURNING id
)

-- 3) Report results
SELECT
  (SELECT COUNT(*) FROM repoint_result) AS offer_trackings_repointed,
  (SELECT COUNT(*) FROM delete_result) AS duplicate_promos_deleted;

COMMIT;

-- ========================================
-- POST-CLEANUP VERIFICATION
-- ========================================

-- Verify cleanup (should return 0 duplicate groups)
SELECT 'After cleanup - duplicate groups:' AS info,
       COALESCE(COUNT(*), 0) AS count
FROM (
  SELECT "whopId","code"
  FROM "PromoCode"
  GROUP BY 1,2
  HAVING COUNT(*) > 1
) x
UNION ALL
SELECT 'After cleanup - total promos:', COUNT(*) FROM "PromoCode";

-- ========================================
-- PREVENTION (run after cleanup if not already present)
-- ========================================
--
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS promo_unique_whop_code
-- ON "PromoCode"("whopId","code");
--
-- This index is now present on both BACKUP and PRODUCTION as of 2025-10-24.
-- ========================================
