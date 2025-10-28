# Whop Content Automation Guide

## Overview

Automate content generation for all 8,000+ whops using LLM APIs (OpenAI or Anthropic) instead of manual copy-paste.

## Pipeline Flow

```
Neon Export → LLM API Generation → JSONL Validation → CSV Build → DB Import
```

---

## Step 1: Export from Neon

### Required Columns

Export from your Neon database with these columns:

**Minimum (for empty whops):**
- `slug` (text)
- `name` (text) - or whatever display name column you have

**Recommended (to skip already-filled rows):**
- `slug`
- `name`
- `aboutContent`
- `howtoRedeemContent`
- `promoDetailsContent`
- `termsContent`
- `faqContent`

### Export Options

**Option A: Export only empty rows (SQL query):**

```sql
SELECT slug, name
FROM "Whop"
WHERE "aboutContent" IS NULL
   OR "howtoRedeemContent" IS NULL
   OR "promoDetailsContent" IS NULL
   OR "termsContent" IS NULL
   OR "faqContent" IS NULL;
```

**Option B: Export all rows (let script filter):**

```sql
SELECT slug, name, "aboutContent", "howtoRedeemContent",
       "promoDetailsContent", "termsContent", "faqContent"
FROM "Whop";
```

### Save Export

Save the export as:
- `data/neon/whops.jsonl` (preferred)
- `data/neon/whops.csv` (also supported)

---

## Step 2: Set Up API Keys

### OpenAI Setup

```bash
export PROVIDER=openai
export MODEL=gpt-4-turbo-preview  # or gpt-4, gpt-3.5-turbo
export OPENAI_API_KEY=sk-...
```

### Anthropic Setup

```bash
export PROVIDER=anthropic
export MODEL=claude-3-5-sonnet-20241022  # or claude-3-opus-20240229
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Step 3: Run Content Generation

### Test Run First (Recommended)

Start with a small batch to:
- Verify API credentials work
- Check output quality
- Estimate cost

```bash
# Generate content for 10 whops only
node scripts/generate-whop-content.mjs --limit=10 --batch=5
```

**Expected output:**
```
Found 10 rows to generate from data/neon/whops.jsonl (provider=openai, model=gpt-4-turbo-preview).
✅ Completed. Wrote to data/content/raw/ai-run-20251027-1200.jsonl. Success=10, batchFails=0
```

### Inspect Test Output

```bash
# Check the generated content
tail -n 1 data/content/raw/ai-run-*.jsonl | jq .

# Verify it has all required keys
cat data/content/raw/ai-run-*.jsonl | jq 'keys'
```

### Full Production Run

Once test looks good, run the full batch:

```bash
# Generate for all rows, skip already-filled ones, save samples every 100
node scripts/generate-whop-content.mjs --skipFilled --batch=10 --limit=8000 --sampleEvery=100

# Monitor progress (from another terminal)
watch -n 5 'wc -l data/content/raw/ai-run-*.jsonl'
```

**Settings:**
- `--skipFilled`: Skip whops that already have all 5 content fields
- `--batch=10`: Process 10 whops concurrently (adjust for rate limits)
- `--limit=8000`: Max rows to process (remove for unlimited)
- `--sampleEvery=100`: Save every 100th success to `data/content/samples/` for quality checks (optional)

**Built-in Features:**
- ✅ **Token tracking**: Logs token usage every 100 completions and at end
- ✅ **HTML sanitization**: Strips script/style tags, removes dangerous attributes
- ✅ **Strict validation**: Enforces 4-6 FAQ items with proper structure
- ✅ **Jittered backoff**: Exponential retry with randomization (smoother rate-limit recovery)
- ✅ **Safe shutdown**: Ctrl+C saves checkpoint before exit

### Resume After Interruption

The script maintains a checkpoint file at `data/content/.checkpoint.json` with:
- `done`: Completed slugs
- `pending`: In-flight slugs (write-ahead marker to prevent duplicate work)

If the process stops (crash, Ctrl+C, etc.), just run it again:

```bash
# Will automatically skip already-completed slugs
node scripts/generate-whop-content.mjs --skipFilled --batch=10 --limit=8000
```

**Safe shutdown:** Press Ctrl+C to gracefully stop. The checkpoint is saved immediately.

---

## Step 4: Build CSV

After generation completes:

```bash
# Merge all raw files + validate → build CSV
npm run content:build
```

**Output:**
- `data/content/combined.jsonl` (all validated records)
- `data/content/combined.csv` (ready for DB import)

---

## Step 5: Import to Database

### Import to BACKUP First

```bash
npm run content:import:backup
```

**Expected output:**
```
NOTICE:  Updated rows: 8000
NOTICE:  Unmatched slugs (not in Whop): 0
COMMIT
```

### Verify on BACKUP

```bash
# Check recent updates
psql "$SOURCE_DATABASE_URL" -c '
SELECT slug,
       LENGTH("aboutContent") AS about_len,
       LENGTH("faqContent") AS faq_len,
       "updatedAt"
FROM "Whop"
WHERE "aboutContent" IS NOT NULL
ORDER BY "updatedAt" DESC
LIMIT 10;
'

# Count filled vs empty
psql "$SOURCE_DATABASE_URL" -c '
SELECT
  COUNT(*) FILTER (WHERE "aboutContent" IS NOT NULL) AS has_about,
  COUNT(*) FILTER (WHERE "aboutContent" IS NULL) AS missing_about,
  COUNT(*) AS total
FROM "Whop";
'
```

### Import to PRODUCTION

Once BACKUP looks good:

```bash
npm run content:import:prod
```

---

## Cost Estimation

### OpenAI Pricing (GPT-4 Turbo)

- Input: ~$0.01 per 1K tokens
- Output: ~$0.03 per 1K tokens
- Avg per whop: ~500 input + 800 output = ~$0.035/whop
- **8,000 whops: ~$280**

### Anthropic Pricing (Claude 3.5 Sonnet)

- Input: ~$0.003 per 1K tokens
- Output: ~$0.015 per 1K tokens
- Avg per whop: ~500 input + 800 output = ~$0.013/whop
- **8,000 whops: ~$104**

### Cost Control

Start with `--limit=200` to estimate actual cost for your specific data:

```bash
# Test 200 rows
node scripts/generate-whop-content.mjs --limit=200 --batch=10

# Check cost in provider dashboard, extrapolate to 8K
```

---

## Quality Control

### Sample Inspection

Use `--sampleEvery` to save exemplars for spot-checking:

```bash
# Save every 50th completion
node scripts/generate-whop-content.mjs --sampleEvery=50 --limit=200

# Inspect samples
ls data/content/samples/
cat data/content/samples/some-slug.json | jq .
```

### Token & Cost Monitoring

The script now tracks tokens in real-time:

```
Progress: ok=100, batchFails=0, tokens={in:45000, out:72000}
Progress: ok=200, batchFails=0, tokens={in:91000, out:145000}
...
✅ Completed. Success=8000, batchFails=12
Token usage summary: input=3600000, output=5760000
```

**Cost calculation:**
- OpenAI GPT-4 Turbo: `(input × $0.01/1K) + (output × $0.03/1K)`
- Anthropic Claude 3.5 Sonnet: `(input × $0.003/1K) + (output × $0.015/1K)`

### HTML Sanitization

All generated content is automatically sanitized:
- ✅ Only allows: `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`
- ❌ Strips: `<script>`, `<style>`, `onclick`, `javascript:` URIs
- ❌ Removes: All other HTML tags (but preserves inner text)

## Troubleshooting

### Rate Limits Hit

Reduce `--batch` concurrency:

```bash
node scripts/generate-whop-content.mjs --batch=5  # slower, safer
```

The script includes jittered backoff (random 0-400ms added to retry delays) for smoother recovery.

### Invalid JSON Responses

The script has 4-attempt retry with exponential backoff + jitter. If a specific whop keeps failing:

1. Check the checkpoint file to see which slug failed
2. Manually inspect that row in your export
3. Check `pending` vs `done` in checkpoint:

```bash
# View checkpoint
cat data/content/.checkpoint.json | jq '.pending'

# If a slug is stuck in pending after multiple runs, it likely has validation issues
```

### Unmatched Slugs

If import reports unmatched slugs:

```sql
-- Find slugs in CSV that aren't in Whop table
SELECT s.slug
FROM _whop_content_stage s
LEFT JOIN "Whop" w ON w.slug = s.slug
WHERE w.slug IS NULL;
```

This usually means:
- Slug was deleted from DB after export
- Slug format mismatch (check casing/encoding)

---

## Output Format

Each generated object has this structure:

```json
{
  "slug": "whop-slug-here",
  "aboutcontent": "<p>Paragraph 1 about the whop...</p><p>Paragraph 2...</p>",
  "howtoredeemcontent": "<p>To redeem this offer:</p><ol><li>Step 1</li><li>Step 2</li></ol>",
  "promodetailscontent": "<ul><li>Detail 1</li><li>Detail 2</li></ul>",
  "termscontent": "<ul><li>Term 1</li><li>Term 2</li></ul>",
  "faqcontent": [
    {
      "question": "Question 1?",
      "answerHtml": "<p>Answer 1...</p>"
    },
    {
      "question": "Question 2?",
      "answerHtml": "<p>Answer 2...</p>"
    }
  ]
}
```

---

## Files Created

```
data/
  neon/
    whops.jsonl or whops.csv         # Your Neon export (you create)
  content/
    .checkpoint.json                  # Resume checkpoint with done + pending (auto-created)
    raw/
      ai-run-20251027-1200.jsonl     # Generated content (auto-created)
    samples/                          # QA exemplars (if --sampleEvery used)
      slug-1.json
      slug-2.json
    combined.jsonl                    # All validated records (auto-created)
    combined.csv                      # Import-ready CSV (auto-created)

scripts/
  generate-whop-content.mjs          # Main automation script
  content-json-array-to-jsonl.mjs    # Normalizer
  validate-and-csv.mjs               # CSV builder

golden-scripts/
  GOLDEN-IMPORT-WHOP-CONTENT.sql     # DB import script
```

---

## Summary Commands

```bash
# 1. Export from Neon → save to data/neon/whops.jsonl

# 2. Set API keys
export PROVIDER=openai MODEL=gpt-4-turbo-preview OPENAI_API_KEY=sk-...

# 3. Test run with samples
node scripts/generate-whop-content.mjs --limit=10 --sampleEvery=5

# 4. Inspect sample quality
cat data/content/samples/*.json | jq .

# 5. Full run with cost tracking
node scripts/generate-whop-content.mjs --skipFilled --batch=10 --limit=8000 --sampleEvery=100

# 6. Build CSV
npm run content:build

# 7. Import to BACKUP
npm run content:import:backup

# 8. Verify + import to PROD
npm run content:import:prod
```

---

## New Features Summary

**✅ HTML Sanitization** - Automatically strips dangerous tags/attributes
**✅ Strict Validation** - Enforces 4-6 FAQ items with proper structure
**✅ Token Tracking** - Real-time cost visibility (logs every 100 completions)
**✅ Jittered Backoff** - Smoother rate-limit recovery (exponential + random 0-400ms)
**✅ Safe Shutdown** - Ctrl+C saves checkpoint immediately
**✅ Sample Export** - `--sampleEvery` for quality spot-checks without parsing big JSONL
**✅ Pending Markers** - Write-ahead checkpointing prevents duplicate work on restart
