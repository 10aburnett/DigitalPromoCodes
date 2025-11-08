#!/bin/bash
# Emergency restore sequence - run if audit fails

echo "=============================================="
echo "🆘 EMERGENCY RESTORE SEQUENCE"
echo "=============================================="
echo "This will attempt to fix common data corruption issues"
echo ""

set -e  # Exit on error

echo "1️⃣  Running consolidation..."
node scripts/consolidate-results.mjs
echo ""

echo "2️⃣  Removing cross-file duplicates..."
node scripts/remove-cross-file-dupes.mjs
echo ""

echo "3️⃣  Fixing misplaced rejects..."
node scripts/fix-misplaced-rejects.mjs
echo ""

echo "4️⃣  Deduplicating successes..."
node scripts/dedupe-jsonl-by-slug.mjs data/content/master/successes.jsonl
echo ""

echo "5️⃣  Deduplicating rejects..."
node scripts/dedupe-jsonl-by-slug.mjs data/content/master/rejects.jsonl
echo ""

echo "6️⃣  Syncing checkpoint from master..."
node scripts/sync-checkpoint-from-master.mjs
echo ""

echo "7️⃣  Final audit..."
node scripts/audit-invariants.mjs
echo ""

echo "=============================================="
echo "✅ RESTORE SEQUENCE COMPLETE"
echo "=============================================="
echo ""
echo "If audit still fails, investigate manually:"
echo "  - Check data/content/master/successes.jsonl for errors"
echo "  - Check data/content/master/rejects.jsonl for missing error fields"
echo "  - Review logs/crash.log for recent errors"
