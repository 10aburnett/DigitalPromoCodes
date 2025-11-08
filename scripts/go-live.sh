#!/bin/bash
# Production go-live sequence - repeatable block for scaling up

set -e  # Exit on error

# Parse arguments
SCOPE="${1:-all}"
LIMIT="${2:-200}"
BUDGET="${3:-50}"

echo "=============================================="
echo "🚀 PRODUCTION GO-LIVE SEQUENCE"
echo "=============================================="
echo "Scope: $SCOPE"
echo "Limit: $LIMIT items"
echo "Budget: \$$BUDGET"
echo "=============================================="
echo ""

# 0) Fresh inventories
echo "📊 Step 0: Refreshing inventories..."
node scripts/query-whops-needing-content.mjs > /tmp/needs-content.csv
node scripts/query-promo-whops.mjs > data/promo-whop-slugs.txt
echo "✅ Inventories refreshed"
echo ""

# 1) Build → preflight
echo "🎯 Step 1: Building batch and running preflight..."
node scripts/build-next-batch.mjs --scope="$SCOPE" --limit="$LIMIT"
node scripts/preflight.mjs --scope="$SCOPE" --limit="$LIMIT"
echo "✅ Batch built and validated"
echo ""

# 2) Run with firm budget and unique RUN_ID
echo "🤖 Step 2: Running content generation..."
export RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
echo "RUN_ID: $RUN_ID"
BUDGET_USD="$BUDGET" LIMIT="$LIMIT" SCOPE="$SCOPE" RUN_ID="$RUN_ID" \
  node scripts/run-all-whops.mjs --scope="$SCOPE" --limit="$LIMIT" --budgetUsd="$BUDGET"
echo "✅ Content generation complete"
echo ""

# 3) Consolidate → audit → sync → audit (must pass)
echo "📦 Step 3: Consolidating and auditing..."
node scripts/consolidate-results.mjs
echo ""
echo "🔍 First audit (pre-sync)..."
node scripts/audit-invariants.mjs
echo ""
echo "🔄 Syncing checkpoint..."
node scripts/sync-checkpoint-from-master.mjs
echo ""
echo "🔍 Second audit (post-sync)..."
node scripts/audit-invariants.mjs
echo ""

echo "=============================================="
echo "✅ GO-LIVE SEQUENCE COMPLETE"
echo "=============================================="
echo ""
echo "Run 'bash scripts/health-check.sh' to verify state"
