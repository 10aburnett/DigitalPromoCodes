#!/bin/bash
# Health check script - run anytime to verify pipeline integrity

echo "=============================================="
echo "🔍 PIPELINE HEALTH CHECK"
echo "=============================================="
echo ""

echo "1️⃣  Checking for errors in successes.jsonl..."
if grep -q '"error"' data/content/master/successes.jsonl 2>/dev/null; then
  ERROR_COUNT=$(grep -c '"error"' data/content/master/successes.jsonl)
  echo "   ❌ Found $ERROR_COUNT errors in successes.jsonl"
  echo "      Run: node scripts/fix-misplaced-rejects.mjs"
else
  echo "   ✅ No errors in successes.jsonl"
fi
echo ""

echo "2️⃣  Checking rejects have error field (first 50)..."
if [ -f data/content/master/rejects.jsonl ]; then
  REJECT_ERRORS=$(head -50 data/content/master/rejects.jsonl | grep -c '"error"')
  echo "   ℹ️  First 50 rejects with error field: $REJECT_ERRORS"
  if [ "$REJECT_ERRORS" -eq 50 ] || [ "$REJECT_ERRORS" -eq $(wc -l < data/content/master/rejects.jsonl 2>/dev/null || echo 0) ]; then
    echo "   ✅ All checked rejects have error field"
  else
    echo "   ⚠️  Some rejects missing error field"
  fi
else
  echo "   ⚠️  rejects.jsonl not found"
fi
echo ""

echo "3️⃣  Checkpoint counts..."
node -e "
import fs from 'fs';
const ck = JSON.parse(fs.readFileSync('data/content/.checkpoint.json', 'utf8'));
const done = Object.keys(ck.done || {}).length;
const rejected = Object.keys(ck.rejected || {}).length;
const queued = Object.keys(ck.queued || {}).length;
console.log(\`   Done: \${done}\`);
console.log(\`   Rejected: \${rejected}\`);
console.log(\`   Queued: \${queued}\`);
console.log(\`   Total tracked: \${done + rejected + queued}\`);
"
echo ""

echo "4️⃣  Running full invariant audit..."
node scripts/audit-invariants.mjs
echo ""

echo "=============================================="
echo "Health check complete!"
echo "=============================================="
