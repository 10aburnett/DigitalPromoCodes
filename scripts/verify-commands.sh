#!/bin/bash

# Manual verification commands for URL normalization
# Run these after deployment to verify the implementation

SITE_URL="${SITE_URL:-https://digitalpromocodes.com}"

echo "🚀 URL Normalization Verification Commands"
echo "Site URL: $SITE_URL"
echo ""

echo "1️⃣ Test Deal Flip Formula (Mixed Case → Lowercase)"
echo "Expected: 301 redirect with Location header pointing to lowercase URL"
echo "curl -I \"$SITE_URL/whop/Deal-Flip-Formula-main\""
curl -I "$SITE_URL/whop/Deal-Flip-Formula-main"
echo ""

echo "2️⃣ Test Deal Flip Formula (Lowercase)"
echo "Expected: 200 OK with canonical tag"
echo "curl -I \"$SITE_URL/whop/deal-flip-formula-main\""
curl -I "$SITE_URL/whop/deal-flip-formula-main"
echo ""

echo "3️⃣ Test Sitemap Accessibility"
echo "Expected: 200 OK"
echo "curl -I \"$SITE_URL/sitemaps/index-1.xml\""
curl -I "$SITE_URL/sitemaps/index-1.xml"
echo ""

echo "4️⃣ Manual Checks:"
echo "   ✓ Verify sitemap URLs are all lowercase:"
echo "     curl -s \"$SITE_URL/sitemaps/index-1.xml\" | grep -o 'https://digitalpromocodes.com/whop/[^<]*' | head -5"
echo ""
echo "   ✓ Check canonical tag on page:"
echo "     curl -s \"$SITE_URL/whop/deal-flip-formula-main\" | grep -o '<link rel=\"canonical\"[^>]*>'"
echo ""

echo "🔍 Google Search Console Actions:"
echo "   1. URL Inspection for /whop/Deal-Flip-Formula-main → should show 'Redirected'"
echo "   2. URL Inspection for /whop/deal-flip-formula-main → should show 'Indexable'"
echo "   3. Request indexing for the lowercase canonical URL"
echo ""

echo "💨 Cache Purging (after deployment):"
echo "   Purge these URLs from CDN/edge cache:"
echo "   - /whop/Deal-Flip-Formula-main"
echo "   - /whop/deal-flip-formula-main"
echo "   - /sitemap.xml"
echo "   - /sitemaps/index-1.xml"