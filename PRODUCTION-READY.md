# 🚀 PRODUCTION-READY AUTONOMOUS CONTENT GENERATION

## ✅ System Status: READY FOR GO-LIVE

All zero-ambiguity hardening complete. The system will process every whop exactly once, with no repeats, and run to completion.

---

## 🎯 How to Run

### Step 1: Complete Promo Whops First (Recommended)
```bash
node scripts/run-all-whops.mjs --scope=promo --limit=150 --budgetUsd=10
```

**What happens:**
- Controller cleans stale artifacts automatically
- Refreshes needs snapshot from DB
- Verifies promo identity balance
- Loops through batches until promo unaccounted = 0
- Stops cleanly when complete

### Step 2: Process All Non-Promo Whops
```bash
node scripts/run-all-whops.mjs --scope=all --limit=200 --budgetUsd=10
```

**What happens:**
- Auto-validates promo identity first (guardrail)
- Runs ALL queue until unaccounted = 0
- Excludes all promo whops automatically
- Stops cleanly when complete

---

## 🔍 Optional Pre-Flight Sanity Check

Before long runs, verify system health:

```bash
# 1. Refresh snapshots
node scripts/query-whops-needing-content.mjs > /tmp/needs-content.csv
node scripts/query-promo-whops.mjs > data/promo-whop-slugs.txt

# 2. Verify promo identity balances
node scripts/preflight.mjs --scope=promo --limit=50

# 3. Smoke test ALL scope with small batch
node scripts/build-next-batch.mjs --scope=all --limit=50
node scripts/preflight.mjs --scope=all --limit=50
```

All checks should pass with `✅ PRE-FLIGHT PASSED`.

---

## 📊 Monitoring Progress

### Live Progress Tracking
```bash
tail -f logs/progress-$(date +%F).tsv
```

**Columns:**
- timestamp: ISO timestamp of batch completion
- scope: promo or all
- done: total completed items
- rejected: total rejected items
- eligible: current eligible candidates
- queue: remaining unaccounted items

### Completion Criteria
Run is complete when preflight shows `unaccounted: 0` for the scope.

---

## 🛡️ Safety Guarantees

The system ensures correctness through:

### 1. Zero-Ambiguity Architecture
- **Single source of truth:** `scripts/lib/sets.mjs` used by both builder and preflight
- **Unified state loading:** `loadState()` ensures identical candidate computation
- **Shared hygiene:** `isValidSlug()` applied consistently everywhere

### 2. Mathematical Identity Enforcement
**Promo scope:** `|P| = |D\M| + |R\M| + |M| + |DENY∩P| + |U|`
- Prevents double-counting (manual excluded from done/rejected)
- Detects drift between sets
- Blocks ALL-scope runs if promo doesn't balance

### 3. Staleness Guards
- Preflight aborts if promo list older than needs snapshot
- Prevents using stale promo data
- Exit code 2 with clear error message

### 4. Atomic Operations
- Batch files written atomically (temp file + rename)
- Summary JSON written atomically
- Prevents corrupted files if process dies mid-write

### 5. Locking & Concurrency
- PID lock in controller prevents concurrent runs
- Generator lock prevents batch overlap
- Safe to restart if process crashes

### 6. Auditability
- Progress logged to `logs/progress-YYYY-MM-DD.tsv`
- Preflight summary saved to `/tmp/preflight-summary.json`
- Complete audit trail of all operations

---

## 🚫 What Gets Excluded Automatically

Every batch excludes:
- ✅ **done:** Items successfully generated (from checkpoint)
- ✅ **rejected:** Items that failed generation (from checkpoint)
- ✅ **manual:** Hand-picked items you'll handle separately
- ✅ **deny:** Permanently excluded (e.g., malformed slug "-")
- ✅ **promo** (for ALL scope): Promo whops handled separately
- ✅ **invalid slugs:** Whitespace, just "-", or malformed

**Exclusion logic:**
```javascript
// Promo scope
candidates = (promo ∩ needs) − (done ∪ rejected ∪ manual ∪ deny)

// ALL scope
candidates = (needs − promo) − (done ∪ rejected ∪ manual ∪ deny)
```

---

## 🔧 Edge Cases Handled

### 1. Malformed Slugs
- The slug "-" is in `data/manual/denylist.txt`
- Automatically excluded from all batches
- Preflight validates and rejects if found

### 2. Missing/Stale Promo File
- Preflight checks file existence
- Verifies mtime vs needs snapshot
- Exits with clear error if stale

### 3. Corrupted Batch File
- Preflight validates every slug with reasoned diagnostics
- Explains WHY each invalid slug was rejected:
  - not-in-promo, not-in-needs
  - already-done, rejected, manual, denylist
  - invalid-slug format
  - promo-item (for ALL scope)

### 4. DB Schema Changes
- Unified loader adapts to checkpoint structure
- Graceful fallback if fields missing
- No data loss on structure changes

---

## 🛠️ Unit Tests

Validate core library functions:

```bash
node scripts/test-sets.mjs
```

**Tests:**
- `isValidSlug()` validation logic (12 tests)
- `toSet()` deduplication
- `writeFileAtomic()` crash safety

All tests must pass before production runs.

---

## 🎛️ Manual Interventions (Rare)

### Force Specific Slugs Next
Add to `data/manual/promo-manual-content.txt`:
```bash
echo "my-special-slug" >> data/manual/promo-manual-content.txt
```

These items are tracked separately and excluded from automated batches.

### Permanently Exclude Items
Add to `data/manual/denylist.txt`:
```bash
echo "bad-slug" >> data/manual/denylist.txt
```

Denied items are excluded from all future batches.

### Adjust Budget/Limits
Change parameters without code changes:
```bash
# Smaller batches, lower budget
node scripts/run-all-whops.mjs --scope=promo --limit=50 --budgetUsd=5

# Larger batches, higher budget
node scripts/run-all-whops.mjs --scope=all --limit=300 --budgetUsd=20
```

---

## 📁 Key Files Reference

### State Management
- `scripts/lib/sets.mjs` - Single source of truth for state loading
- `/tmp/needs-content.csv` - DB snapshot of whops needing content
- `data/promo-whop-slugs.txt` - Whops with promo codes (846 items)
- `data/content/.checkpoint.json` - Done/rejected/deferred tracking
- `data/manual/promo-manual-content.txt` - Hand-picked items (32 items)
- `data/manual/denylist.txt` - Permanently excluded (1 item: "-")

### Batch Processing
- `/tmp/next-batch.txt` - Current batch (newline-separated)
- `/tmp/next-batch.csv` - Current batch (comma-separated)
- `/tmp/preflight-summary.json` - Latest preflight metrics

### Audit Trail
- `logs/progress-YYYY-MM-DD.tsv` - Daily progress log
- `logs/crash.log` - Error reports if controller crashes

### Control Scripts
- `scripts/run-all-whops.mjs` - Autonomous controller (main entry point)
- `scripts/preflight.mjs` - Validation with identity math
- `scripts/build-next-batch.mjs` - Deterministic batch builder
- `scripts/generate-whop-content.mjs` - AI content generator
- `scripts/consolidate-results.mjs` - Idempotent result merger

---

## 🎓 Architecture Principles

### Idempotency
Every operation can be safely rerun:
- Consolidation merges without duplication
- Preflight validates before spend
- Atomic writes prevent partial updates

### Determinism
Same inputs always produce same outputs:
- Candidates sorted alphabetically
- Unified state loading everywhere
- No random selection or ordering

### Fail-Safe Defaults
System errs on side of caution:
- Rejects stale promo data
- Blocks on identity math failures
- Validates batches before generation
- Exits cleanly on unrecoverable errors

---

## 🚀 Bottom Line

**YES** - The system will:
- Process **all** remaining whops (per scope)
- Without **any** repeats
- Loop to **completion** automatically
- Stop cleanly when **unaccounted = 0**

**NO** - You do NOT need to:
- Build batches manually
- Track progress manually
- Worry about double-processing
- Intervene during runs (unless crash)

**The two commands above (promo, then all) are sufficient to complete the entire corpus safely and deterministically.**

---

## 📞 Quick Reference

```bash
# Run unit tests
node scripts/test-sets.mjs

# Complete promo scope
node scripts/run-all-whops.mjs --scope=promo --limit=150 --budgetUsd=10

# Complete all scope
node scripts/run-all-whops.mjs --scope=all --limit=200 --budgetUsd=10

# Monitor progress
tail -f logs/progress-$(date +%F).tsv

# Check current state
node scripts/preflight.mjs --scope=promo --limit=1
node scripts/preflight.mjs --scope=all --limit=1
```

---

**System Status:** ✅ PRODUCTION-READY
**Last Updated:** 2025-11-06
**Validation:** All smoke tests passed, all safeguards active
