/**
 * 🏆 GOLDEN VERIFY TITLE & CODE CONSISTENCY
 * Verifies that all promo codes and titles are correctly formatted:
 * - All codes are lowercase
 * - Currency titles like "$10.00 Off" don't have % symbols
 * - Percent titles like "25% Off" are properly formatted
 * - Titles match their value field intent
 */

\echo '═══════════════════════════════════════════════════════════════'
\echo '1) SUMMARY COUNTS + RED FLAGS'
\echo '═══════════════════════════════════════════════════════════════'

WITH
percent_title AS (
  SELECT id FROM "PromoCode"
  WHERE title ~* '^\s*\d+(?:\.\d+)?\s*%\s+off(?:\s|$|[^0-9A-Za-z])'
),
currency_title AS (
  SELECT id FROM "PromoCode"
  WHERE title ~* '^\s*[$£€]\s*\d'
    AND title ~* '\boff\b'
),
-- Bad: currency title that also has a % before Off
currency_with_percent AS (
  SELECT id, title FROM "PromoCode"
  WHERE title ~* '^\s*[$£€]\s*\d'
    AND title ~* '%'
    AND title ~* '\boff\b'
),
-- Bad: percent title that starts with currency
percent_but_currency_first AS (
  SELECT id, title FROM "PromoCode"
  WHERE title ~* '^\s*[$£€]\s*\d'
    AND title ~* '^\s*\d+(?:\.\d+)?\s*%\s+off(?:\s|$|[^0-9A-Za-z])'
),
-- Bad: currency amount without "Off"
currency_without_off AS (
  SELECT id, title FROM "PromoCode"
  WHERE title ~* '^\s*[$£€]\s*\d'
    AND title !~* '\boff\b'
),
-- Bare-number titles (should be zero after fixes)
bare_number_title AS (
  SELECT id, title FROM "PromoCode"
  WHERE title ~ '^\s*\d+(\.\d+)?\s+[A-Z]'
),
-- Code not lowercase (should be zero due to check constraint)
code_not_lower AS (
  SELECT id, code FROM "PromoCode"
  WHERE code <> lower(code)
)
SELECT
  (SELECT COUNT(*) FROM "PromoCode")                                   AS total_promos,
  (SELECT COUNT(*) FROM percent_title)                                  AS percent_off_titles,
  (SELECT COUNT(*) FROM currency_title)                                 AS currency_off_titles,
  (SELECT COUNT(*) FROM code_not_lower)                                 AS code_not_lower,
  (SELECT COUNT(*) FROM bare_number_title)                              AS malformed_bare_number,
  (SELECT COUNT(*) FROM currency_with_percent)                          AS bad_currency_with_percent,
  (SELECT COUNT(*) FROM percent_but_currency_first)                     AS bad_percent_but_currency_first,
  (SELECT COUNT(*) FROM currency_without_off)                           AS bad_currency_without_off;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '2) TITLE-VALUE ALIGNMENT CHECK'
\echo '═══════════════════════════════════════════════════════════════'

WITH
value_percent AS (
  SELECT id FROM "PromoCode"
  WHERE value ~* '^\s*\d+(\.\d+)?\s*%(\s*Off)?\s*$'
     OR (value ~ '^\s*\d+(\.\d+)?\s*$' AND (substring(value from '^\s*([0-9]+(?:\.[0-9]+)?)\s*$'))::numeric <= 100)
),
value_currency AS (
  SELECT id FROM "PromoCode"
  WHERE value ~* '^\s*[$£€]'
),
title_percent AS (
  SELECT id FROM "PromoCode"
  WHERE title ~* '^\s*\d+(?:\.\d+)?\s*%\s+off(?:\s|$|[^0-9A-Za-z])'
),
title_currency AS (
  SELECT id FROM "PromoCode"
  WHERE title ~* '^\s*[$£€]\s*\d'
    AND title ~* '\boff\b'
)
SELECT
  -- If value implies percent, title must be percent-off
  (SELECT COUNT(*) FROM value_percent vp
   LEFT JOIN title_percent tp ON tp.id = vp.id
   WHERE tp.id IS NULL) AS value_percent_title_not_percent,

  -- If value implies currency, title must be currency-off (and not include %)
  (SELECT COUNT(*) FROM value_currency vc
   LEFT JOIN title_currency tc ON tc.id = vc.id
   WHERE tc.id IS NULL) AS value_currency_title_not_currency;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '3) OFFENDERS (Currency titles with % symbol)'
\echo '═══════════════════════════════════════════════════════════════'

SELECT id, title, value
FROM "PromoCode"
WHERE title ~* '^\s*[$£€]\s*\d'
  AND title ~* '%'
  AND title ~* '\boff\b'
LIMIT 50;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '4) OFFENDERS (Currency amounts without Off)'
\echo '═══════════════════════════════════════════════════════════════'

SELECT id, title, value
FROM "PromoCode"
WHERE title ~* '^\s*[$£€]\s*\d'
  AND title !~* '\boff\b'
LIMIT 50;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '5) OFFENDERS (Value is percent but title is not)'
\echo '═══════════════════════════════════════════════════════════════'

WITH value_percent AS (
  SELECT id FROM "PromoCode"
  WHERE value ~* '^\s*\d+(\.\d+)?\s*%(\s*Off)?\s*$'
     OR (value ~ '^\s*\d+(\.\d+)?\s*$' AND (substring(value from '^\s*([0-9]+(?:\.[0-9]+)?)\s*$'))::numeric <= 100)
),
title_percent AS (
  SELECT id FROM "PromoCode"
  WHERE title ~* '^\s*\d+(?:\.\d+)?\s*%\s+off(?:\s|$|[^0-9A-Za-z])'
)
SELECT p.id, p.title, p.value
FROM value_percent vp
JOIN "PromoCode" p ON p.id = vp.id
LEFT JOIN title_percent tp ON tp.id = vp.id
WHERE tp.id IS NULL
LIMIT 50;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '6) SAMPLE CURRENCY TITLES (Should be like "$10.00 Off...")'
\echo '═══════════════════════════════════════════════════════════════'

SELECT id, title, value
FROM "PromoCode"
WHERE title ~* '^\s*[$£€]\s*\d'
  AND title ~* '\boff\b'
ORDER BY title
LIMIT 20;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo '7) SAMPLE PERCENT TITLES (Should be like "25% Off...")'
\echo '═══════════════════════════════════════════════════════════════'

SELECT id, title, value
FROM "PromoCode"
WHERE title ~* '^\s*\d+(?:\.\d+)?\s*%\s+off(?:\s|$|[^0-9A-Za-z])'
ORDER BY title
LIMIT 20;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'VERIFICATION COMPLETE'
\echo 'Expected results for clean database:'
\echo '  - code_not_lower: 0'
\echo '  - malformed_bare_number: 0'
\echo '  - bad_currency_with_percent: 0'
\echo '  - bad_percent_but_currency_first: 0'
\echo '  - bad_currency_without_off: 0'
\echo '  - value_percent_title_not_percent: 0'
\echo '  - value_currency_title_not_currency: 0'
\echo '═══════════════════════════════════════════════════════════════'
