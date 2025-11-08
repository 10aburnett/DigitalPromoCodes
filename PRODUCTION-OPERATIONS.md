# Production Operations Guide

**Pipeline Version:** `content-pipeline-stable-2025-11-08`

This guide covers all production operations for the autonomous content generation pipeline.

---

## 🚀 Quick Start: Running Production Batches

### Using the Go-Live Script (Recommended)

```bash
# Full production run: 200 items, $50 budget
bash scripts/go-live.sh all 200 50

# Smaller test run: 50 items, $15 budget
bash scripts/go-live.sh all 50 15

# Promo-only run: 100 items, $25 budget
bash scripts/go-live.sh promo 100 25
```

### Manual Production Sequence

```bash
# 0) Fresh inventories
node scripts/query-whops-needing-content.mjs > /tmp/needs-content.csv
node scripts/query-promo-whops.mjs > data/promo-whop-slugs.txt

# 1) Build → preflight
node scripts/build-next-batch.mjs --scope=all --limit=200
node scripts/preflight.mjs        --scope=all --limit=200

# 2) Run with firm budget and unique RUN_ID
export RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
BUDGET_USD=50 LIMIT=200 SCOPE=all RUN_ID="$RUN_ID" \
node scripts/run-all-whops.mjs --scope=all --limit=200 --budgetUsd=50

# 3) Consolidate → audit → sync → audit (must pass)
node scripts/consolidate-results.mjs
node scripts/audit-invariants.mjs
node scripts/sync-checkpoint-from-master.mjs
node scripts/audit-invariants.mjs
```

---

## 🔍 Health Checks

### Quick Health Check (Recommended)

```bash
bash scripts/health-check.sh
```

### Manual Health Checks

```bash
# Check for errors in successes
grep -n '"error"' data/content/master/successes.jsonl || echo "OK: no errors"

# Check rejects have error field (first 50)
head -50 data/content/master/rejects.jsonl | grep -c '"error"'

# View checkpoint counts
node -e "import fs from 'fs'; const ck=JSON.parse(fs.readFileSync('data/content/.checkpoint.json','utf8')); console.log({done:Object.keys(ck.done||{}).length,rejected:Object.keys(ck.rejected||{}).length,queued:Object.keys(ck.queued||{}).length})"

# Full invariant audit
node scripts/audit-invariants.mjs
```

---

## 🆘 Emergency Procedures

### If Audit Fails

```bash
# Automated restore sequence
bash scripts/emergency-restore.sh
```

### Manual Restore Sequence

```bash
node scripts/consolidate-results.mjs
node scripts/remove-cross-file-dupes.mjs
node scripts/fix-misplaced-rejects.mjs
node scripts/dedupe-jsonl-by-slug.mjs data/content/master/successes.jsonl
node scripts/dedupe-jsonl-by-slug.mjs data/content/master/rejects.jsonl
node scripts/sync-checkpoint-from-master.mjs
node scripts/audit-invariants.mjs
```

### If Data Loss Suspected

1. Check backups: `ls -lt data/content/master/*.backup*`
2. Review crash log: `tail -100 logs/crash.log`
3. Check git history: `git log --oneline -20`
4. Restore from recent commit if needed

---

## ✅ Definition of "All Good"

Every production cycle must meet these criteria:

- ✅ `audit-invariants.mjs` exits 0 (both pre- and post-sync)
- ✅ `successes.jsonl`: 0 matches for `"error"`
- ✅ `rejects.jsonl`: all lines contain `"error"` field
- ✅ Checkpoint counts ≈ file counts (small delta allowed for queued items)
- ✅ No ESM/CJS warnings in console output

---

## 🛡️ Safety Features

### Budget Ceiling Guard

The pipeline will refuse to start if budget is insufficient:

```bash
# This will fail with clear error message
node scripts/run-all-whops.mjs --scope=all --limit=200 --budgetUsd=10

# Error:
# ❌ Budget too low for batch size.
#    Batch size: 200 items
#    Budget: $10
#    Minimum recommended: $50.00 (at ~$0.25/item)
```

### File Locking

Only one batch builder can run at a time. Concurrent runs will fail with:
```
❌ Batch builder is already running (lock present)
```

### Preflight Filtering

Preflight now **warns and rewrites** instead of crashing:
- Invalid slugs removed
- Already-done items filtered out
- Not-queued items removed
- Batch file rewritten with only valid items

### RUN_ID Isolation

Each run gets unique output files:
```
ai-run-20251108T135045Z-20692.jsonl
rejects-20251108T135045Z-20692.jsonl
```

This prevents mixing data from multiple runs.

---

## 📊 Monitoring Progress

### Check Remaining Work

```bash
# Total whops needing content
node scripts/query-whops-needing-content.mjs | wc -l

# Items in checkpoint
node -e "import fs from 'fs'; const ck=JSON.parse(fs.readFileSync('data/content/.checkpoint.json','utf8')); const total = Object.keys(ck.done||{}).length + Object.keys(ck.rejected||{}).length + Object.keys(ck.queued||{}).length; console.log('Tracked:', total)"

# Progress percentage
node -e "import fs from 'fs'; const ck=JSON.parse(fs.readFileSync('data/content/.checkpoint.json','utf8')); const done=Object.keys(ck.done||{}).length; const total=done+Object.keys(ck.rejected||{}).length; console.log('Progress:', (done/8218*100).toFixed(1) + '%')"
```

### View Recent Runs

```bash
# Check consolidation telemetry
tail -10 data/content/master/.consolidation-telemetry.jsonl | jq
```

---

## 🔧 Troubleshooting

### Problem: "BATCH INVALID" errors

**Cause:** Preflight validating stale batch from previous run

**Fix:** Already resolved. Batch builder now runs BEFORE preflight.

### Problem: Errors appearing in successes.jsonl

**Cause:** Three leak points in consolidation/promotion/sync

**Fix:** Already resolved. Three-layer error routing implemented.

### Problem: Checkpoint count mismatch

**Cause:** Items marked in checkpoint but not in files (usually queued items that failed early)

**Fix:** Run emergency restore sequence, or manually:
```bash
node /tmp/fix-checkpoint-drift.mjs
node scripts/audit-invariants.mjs
```

### Problem: Old files getting reused

**Cause:** RUN_ID not being respected

**Fix:** Ensure RUN_ID is exported:
```bash
export RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
```

---

## 📈 Scaling Guidelines

### Conservative (Safe)
- Batch size: 50-100 items
- Budget: $15-25 per batch
- Run frequency: Every 2-4 hours

### Standard (Balanced)
- Batch size: 150-200 items
- Budget: $40-50 per batch
- Run frequency: Every 4-6 hours

### Aggressive (Fast)
- Batch size: 200+ items
- Budget: $50+ per batch
- Run frequency: Continuous (autonomous mode)

**Budget Rule of Thumb:** ~$0.25 per item minimum

---

## 🔐 Best Practices

1. **Always run health check** before scaling up
2. **Monitor first batch** of each session
3. **Check audit output** after every consolidation
4. **Use go-live.sh script** for consistency
5. **Tag stable states** for easy rollback
6. **Review crash log** if unexpected failures occur
7. **Keep budgets realistic** (guard will help)
8. **Don't bypass locks** - they prevent race conditions

---

## 📝 File Structure

```
data/content/
├── master/
│   ├── successes.jsonl          # All successful generations (SSOT)
│   ├── rejects.jsonl             # All failed items with error field
│   ├── updates.jsonl             # Temporary: better versions (cleared after promotion)
│   ├── _processed-master-slugs.txt    # Fast lookup index
│   ├── _rejected-master-slugs.txt     # Fast lookup index
│   └── .consolidation-telemetry.jsonl # Audit trail
├── raw/
│   ├── ai-run-*.jsonl           # Raw output from generator
│   ├── rejects-*.jsonl          # Raw rejects from generator
│   └── _archive/                # Old files (skipped by consolidation)
├── .checkpoint.json             # State tracking: done, rejected, queued
└── .usage.json                  # Token usage tracking

scripts/
├── go-live.sh                   # Full production sequence
├── health-check.sh              # Quick health verification
├── emergency-restore.sh         # Fast repair if audit fails
├── run-all-whops.mjs           # Autonomous controller
├── build-next-batch.mjs        # Batch builder (with locking)
├── preflight.mjs               # Validation (filters instead of crashes)
├── consolidate-results.mjs     # Idempotent consolidation
├── audit-invariants.mjs        # Data integrity checks
└── sync-checkpoint-from-master.mjs  # Checkpoint synchronization
```

---

## 🏷️ Version History

**Current:** `content-pipeline-stable-2025-11-08`
- File locking
- Queued-stamping
- Preflight filtering
- Three-layer error routing
- RUN_ID scoping
- Budget ceiling guard
- Invariant audits
- Helper scripts

---

## 🆘 Support

If you encounter issues not covered here:

1. Run health check: `bash scripts/health-check.sh`
2. Check crash log: `cat logs/crash.log`
3. Review recent git commits: `git log --oneline -10`
4. Compare with stable tag: `git diff content-pipeline-stable-2025-11-08`

**Remember:** The pipeline has backtracking scripts. Most issues can be auto-resolved with the emergency restore sequence.
