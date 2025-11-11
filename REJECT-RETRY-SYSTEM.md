# Reject-Retry System Implementation

**Date**: 2025-11-10
**Status**: ✅ **Phase 1 Complete** - All infrastructure ready for retry phases

---

## 📊 Current Reject Statistics

### Bucketization Results
```
HTTP_404:               1813 slugs (67.6%) - Need verification
GUARDRAIL_FAIL:          468 slugs (17.4%) - Need relaxed retry
NETWORK_FETCH_FAIL:      197 slugs ( 7.3%) - Need simple retry
RATE_LIMIT:              131 slugs ( 4.9%) - Need simple retry
OTHER:                    73 slugs ( 2.7%) - Need investigation
INSUFFICIENT_EVIDENCE:     0 slugs ( 0.0%) - (classified as 404/other)
TIMEOUT:                   0 slugs ( 0.0%) - (none found)
───────────────────────────────────────
TOTAL:                  2682 slugs (100%)
```

**Recovery files**: `data/recovery/rejects-{errorCode}.csv`

---

## ✅ Phase 1: Infrastructure Implementation

### 1. Enhanced Error Classification ✅
**File**: `scripts/generate-whop-content.mjs:1029-1060`

**Changes**:
- Upgraded `rejectAndPersist()` function to include `errorCode` and `meta`
- Automatic classification of errors into machine-readable buckets:
  - `HTTP_404` - 404 errors or insufficient evidence
  - `NETWORK_FETCH_FAIL` - Network/fetch failures
  - `GUARDRAIL_FAIL` - Content quality violations (grounding, repair, primary keyword, etc.)
  - `RATE_LIMIT` - API rate limit errors
  - `TIMEOUT` - Request timeout errors
  - `OTHER` - Uncategorized errors

**New reject entry format**:
```json
{
  "slug": "example-whop",
  "error": "Repair failed: howtoredeemcontent must use <ol> for steps",
  "errorCode": "GUARDRAIL_FAIL",
  "meta": {},
  "ts": "2025-11-10T12:00:00.000Z"
}
```

---

### 2. Bucketization Script ✅
**File**: `scripts/rejects-bucketize.mjs`

**Purpose**: Classify all existing rejects into CSV files by errorCode

**Usage**:
```bash
node scripts/rejects-bucketize.mjs
```

**Output**:
- `data/recovery/rejects-HTTP_404.csv`
- `data/recovery/rejects-GUARDRAIL_FAIL.csv`
- `data/recovery/rejects-NETWORK_FETCH_FAIL.csv`
- `data/recovery/rejects-RATE_LIMIT.csv`
- `data/recovery/rejects-OTHER.csv`

---

### 3. Retry Control System ✅
**File**: `scripts/generate-whop-content.mjs:1017-1025, 2906-2916`

**New Environment Variables**:
```bash
MAX_RETRIES=3                    # Maximum retry attempts per slug
IGNORE_CHECKPOINT=1              # Allow reattempts (bypass done/rejected check)
ALLOW_OVERWRITE=1                # Allow overwriting existing content
EVIDENCE_ONLY=1                  # Probe mode (no model calls)
```

**Retry State Tracking**:
- File: `data/content/retry-counts.json`
- Tracks attempts per slug to prevent infinite loops
- Automatic rejection after MAX_RETRIES attempts with errorCode=ABANDONED

**Worker Integration**:
```javascript
// At start of worker() function
if (IGNORE_CHECKPOINT) {
  const attempts = bumpRetry(slug);
  if (attempts > MAX_RETRIES) {
    rejectAndPersist(slug, `abandoned after ${attempts} attempts`, { errorCode: "ABANDONED" });
    return;
  }
}
```

---

### 4. Relaxed Guardrails System ✅
**File**: `scripts/generate-whop-content.mjs:1009-1012, 2347-2371`

**New Environment Variables**:
```bash
RELAX_GUARDRAILS=1               # Enable relaxed content quality checks
MIN_EVIDENCE_CHARS=800           # Strict evidence threshold (default)
RELAXED_MIN_EVIDENCE_CHARS=350   # Relaxed evidence threshold
```

**Relaxed Thresholds** (60% of normal, +20% on max):
| Metric | Normal | Relaxed Min | Relaxed Max |
|--------|--------|-------------|-------------|
| About paragraphs | 2-3 | 1-4 | 1-4 |
| About words | 120-180 | 72-216 | 72-216 |
| Redeem steps | 3-5 | 2-6 | 2-6 |
| Redeem step words | 10-20 | 6-24 | 6-24 |
| Details bullets | 3-5 | 2-6 | 2-6 |
| Details words | 100-150 | 60-180 | 60-180 |
| Terms bullets | 3-5 | 2-6 | 2-6 |
| Terms words | 80-120 | 48-144 | 48-144 |
| FAQ count | 3-6 | 2-7 | 2-7 |
| FAQ answer words | 40-70 | 24-84 | 24-84 |

---

### 5. 404 Verification Script ✅
**File**: `scripts/verify-404.mjs`

**Purpose**: Verify which HTTP_404 rejects are truly dead vs recoverable

**Features**:
- Tests original URL + alternatives (http↔https, trailing slash variants)
- 8-second timeout per request
- Rate-limiting delay (100ms between requests)
- Outputs CSV with status: RECOVERABLE, HARD_404, NO_URL

**Usage**:
```bash
node scripts/verify-404.mjs data/recovery/rejects-HTTP_404.csv
# Output: logs/verify-404.csv

# Extract recoverable slugs
awk -F, '$2=="RECOVERABLE"{print $1}' logs/verify-404.csv > /tmp/urls-recoverable.csv

# Extract hard 404s
awk -F, '$2=="HARD_404"{print $1}' logs/verify-404.csv > /tmp/urls-hard.csv
```

---

## 🔄 Phase 2: Recovery Phases (Ready to Execute)

### Phase A: Network/Transient Retries
**Target**: 197 NETWORK_FETCH_FAIL + 131 RATE_LIMIT = **328 slugs**

**Strategy**: Probe-first approach (avoid spending on pages that still have no content)

**Step 1: Probe for evidence**
```bash
EVIDENCE_ONLY=1 IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 MIN_EVIDENCE_CHARS=800 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="data/recovery/rejects-NETWORK_FETCH_FAIL.csv" \
  --batch=10

EVIDENCE_ONLY=1 IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 MIN_EVIDENCE_CHARS=800 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="data/recovery/rejects-RATE_LIMIT.csv" \
  --batch=10
```

**Step 2: Extract READY slugs**
```bash
awk -F, '$2=="READY"{print $1}' logs/retry-191-evidence.csv | sort -u > /tmp/retry-ready.csv
```

**Step 3: Generate content for READY slugs**
```bash
export MODEL=gpt-4o-mini OPENAI_API_KEY="YOUR_KEY" ITEM_BUDGET_USD=0.05
IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 MAX_RETRIES=2 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="/tmp/retry-ready.csv" \
  --batch=10 \
  --budgetUsd=25
```

---

### Phase B: Guardrail Failures
**Target**: 468 GUARDRAIL_FAIL slugs

**Strategy**: Relax quality checks while maintaining reasonable standards

```bash
export MODEL=gpt-4o-mini OPENAI_API_KEY="YOUR_KEY" ITEM_BUDGET_USD=0.05
RELAX_GUARDRAILS=1 IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 \
MIN_EVIDENCE_CHARS=800 MAX_RETRIES=2 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="data/recovery/rejects-GUARDRAIL_FAIL.csv" \
  --batch=10 \
  --budgetUsd=25
```

---

### Phase C: Insufficient Evidence (Future)
**Target**: Currently 0 slugs (classified as HTTP_404 or OTHER)

**Strategy**: Progressive relaxation if needed

**Step 1: Strict probe**
```bash
EVIDENCE_ONLY=1 IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 MIN_EVIDENCE_CHARS=800 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="data/recovery/rejects-INSUFFICIENT_EVIDENCE.csv" \
  --batch=10
```

**Step 2: Generate with strict rules for READY**
```bash
awk -F, '$2=="READY"{print $1}' logs/retry-191-evidence.csv | sort -u > /tmp/evidence-strict-ready.csv

MODEL=gpt-4o-mini OPENAI_API_KEY="YOUR_KEY" ITEM_BUDGET_USD=0.05 \
IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 RELAX_GUARDRAILS=0 MAX_RETRIES=2 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="/tmp/evidence-strict-ready.csv" \
  --batch=10 \
  --budgetUsd=25
```

**Step 3: Relaxed pass for remainder**
```bash
MODEL=gpt-4o-mini OPENAI_API_KEY="YOUR_KEY" ITEM_BUDGET_USD=0.05 \
IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 RELAX_GUARDRAILS=1 \
RELAXED_MIN_EVIDENCE_CHARS=350 MAX_RETRIES=2 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="data/recovery/rejects-INSUFFICIENT_EVIDENCE.csv" \
  --batch=10 \
  --budgetUsd=25
```

---

### Phase D: True 404 Verification
**Target**: 1813 HTTP_404 slugs

**Step 1: Verify URLs**
```bash
node scripts/verify-404.mjs data/recovery/rejects-HTTP_404.csv
# Output: logs/verify-404.csv
```

**Step 2: Retry recoverable URLs**
```bash
awk -F, '$2=="RECOVERABLE"{print $1}' logs/verify-404.csv > /tmp/urls-recoverable.csv

IGNORE_CHECKPOINT=1 ALLOW_OVERWRITE=1 MAX_RETRIES=1 \
node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl \
  --onlySlugsFile="/tmp/urls-recoverable.csv" \
  --batch=10 \
  --budgetUsd=25
```

**Step 3: Permanently park hard 404s**
```bash
awk -F, '$2=="HARD_404"{print $1}' logs/verify-404.csv > data/recovery/permanent-404s.csv
```

---

## 📈 Expected Recovery Rates

Based on error classification:

| Category | Count | Expected Recovery | Estimated Successes |
|----------|-------|-------------------|---------------------|
| NETWORK_FETCH_FAIL | 197 | 60-80% | 118-157 |
| RATE_LIMIT | 131 | 80-95% | 105-124 |
| GUARDRAIL_FAIL | 468 | 70-85% | 328-398 |
| HTTP_404 (recoverable) | ~300-500 | 50-70% | 150-350 |
| **TOTAL RECOVERABLE** | **~1096-1296** | **~65-75%** | **~701-1029** |

**Hard 404s** (1313-1513 slugs): Permanently rejected, no content possible

---

## 🛡️ Safety Features

### 1. Retry Ceiling
- `MAX_RETRIES=3` (default) or `MAX_RETRIES=2` for retry phases
- Automatic rejection with `errorCode=ABANDONED` after max attempts
- State persisted in `data/content/retry-counts.json`

### 2. Budget Controls
- Per-run: `--budgetUsd=25` flag
- Per-item: `ITEM_BUDGET_USD=0.05` env var
- Automatic abort if projected spend exceeds budget

### 3. Crash-Safe Writes
- Immediate append to `data/content/master/rejects.jsonl`
- Immediate append to `data/content/master/successes.jsonl`
- Checkpoint persistence after each slug
- No data loss even on crashes

### 4. Write-Once Guard
- Master index prevents duplicate writes
- Per-run tracking in memory
- Prevents accumulating duplicates

---

## 📝 Audit After Each Phase

```bash
# Consolidate all raw runs into master files
node scripts/consolidate-content.mjs

# Run invariant checks
node scripts/audit-invariants.mjs

# Check counts
wc -l data/content/master/successes.jsonl data/content/master/rejects.jsonl
```

---

## 🎯 Next Steps

1. **Run Phase A** (Network/Transient retries)
   - Expected recovery: 223-281 slugs
   - Cost estimate: $10-15 USD

2. **Run Phase B** (Guardrail failures with relaxed rules)
   - Expected recovery: 328-398 slugs
   - Cost estimate: $15-20 USD

3. **Run Phase D** (Verify and retry 404s)
   - Verification: FREE (HTTP requests only)
   - Expected recovery: 150-350 slugs
   - Cost estimate: $5-15 USD

4. **Consolidate and audit**
   - Validate all new content
   - Update master indices
   - Generate final report

**Total expected recovery**: 701-1029 slugs (~26-38% of rejects)
**Total estimated cost**: $30-50 USD

---

## 🔧 Environment Variables Reference

```bash
# Retry Controls
IGNORE_CHECKPOINT=1              # Allow reattempts
ALLOW_OVERWRITE=1                # Allow overwriting existing content
MAX_RETRIES=2                    # Retry ceiling per slug

# Evidence Controls
EVIDENCE_ONLY=1                  # Probe mode (no model calls)
MIN_EVIDENCE_CHARS=800           # Strict evidence threshold
RELAXED_MIN_EVIDENCE_CHARS=350   # Relaxed evidence threshold

# Quality Controls
RELAX_GUARDRAILS=1               # Enable relaxed content quality checks

# Model Configuration
MODEL=gpt-4o-mini                # Model to use
OPENAI_API_KEY=...               # API key
ITEM_BUDGET_USD=0.05             # Per-item budget limit
```

---

## ✅ Implementation Status

- [x] Enhanced error classification with errorCode
- [x] Bucketization script (rejects-bucketize.mjs)
- [x] Retry state tracking with MAX_RETRIES
- [x] Relaxed guardrails system
- [x] 404 verification script (verify-404.mjs)
- [x] Documentation and usage guides
- [ ] Execute Phase A (Network/transient retries)
- [ ] Execute Phase B (Guardrail failures)
- [ ] Execute Phase D (404 verification and retry)
- [ ] Generate final recovery report

**Status**: Infrastructure complete, ready for execution phases

---

## 📧 Support

For issues or questions:
- Check logs in `/logs/` directory
- Review audit output from `audit-invariants.mjs`
- Examine retry counts in `data/content/retry-counts.json`
- Review bucketized rejects in `data/recovery/`
