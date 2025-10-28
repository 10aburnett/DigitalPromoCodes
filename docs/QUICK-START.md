# Quick Start - Whop Content Generation

## Prerequisites

- [ ] Neon database with `Whop` table
- [ ] OpenAI API key (recommended: gpt-4o-mini)
- [ ] Node.js installed
- [ ] `psql` installed (for DB import)

---

## Step-by-Step Workflow

### 1️⃣ Export from Neon

**SQL Query**:
```sql
SELECT slug, name
FROM "Whop"
WHERE "aboutContent" IS NULL
   OR "howtoRedeemContent" IS NULL
   OR "promoDetailsContent" IS NULL
   OR "termsContent" IS NULL
   OR "faqContent" IS NULL;
```

**Save as**: `data/neon/whops.jsonl` (JSONL format, one object per line)

**If Neon exports JSON array** (brackets with objects):
```bash
cat data/neon/whops.json | jq -c '.[]' > data/neon/whops.jsonl
```

---

### 2️⃣ Set Environment

```bash
export PROVIDER=openai
export MODEL=gpt-4o-mini
export STRONG_MODEL=gpt-4o
export OPENAI_API_KEY=sk-proj-...
```

**Verify**:
```bash
echo $OPENAI_API_KEY  # Should print your key
```

---

### 3️⃣ Test Run (50 whops, $5 cap)

**Terminal 1 - Run generation**:
```bash
node scripts/generate-whop-content.mjs \
  --limit=50 \
  --batch=8 \
  --sampleEvery=10 \
  --budgetUsd=5
```

**Terminal 2 - Monitor progress** (optional):
```bash
npm run content:monitor
```

**Expected output**:
```
Found 50 rows to generate from data/neon/whops.jsonl (provider=openai, model=gpt-4o-mini).
Progress: ok=10, batchFails=0, tokens={in:4500, out:7200}
Progress: ok=20, batchFails=0, tokens={in:9000, out:14400}
Progress: ok=30, batchFails=0, tokens={in:13500, out:21600}
Progress: ok=40, batchFails=0, tokens={in:18000, out:28800}
Progress: ok=50, batchFails=0, tokens={in:22500, out:36000}
✅ Completed. Wrote to data/content/raw/ai-run-20251027-1200.jsonl. Success=50, batchFails=0
Token usage summary: input=22500, output=36000
```

---

### 4️⃣ Validate Test Results

**Check samples**:
```bash
# View structure
cat data/content/samples/*.json | jq '{
  slug,
  p: (.aboutcontent | scan("<p") | length),
  redeem_li: (.howtoredeemcontent | scan("<li") | length),
  details_li: (.promodetailscontent | scan("<li") | length),
  faq_count: (.faqcontent | length)
}'
```

**Expected output**:
```json
{
  "slug": "example-whop",
  "p": 3,                    // Should be 2-3
  "redeem_li": 5,            // Should be 4-6
  "details_li": 6,           // Should be 5-7
  "faq_count": 5             // Should be 4-6
}
```

**Check cost**:
```bash
# From token summary:
# input=22500, output=36000
# Cost = (22500 × 0.00015) + (36000 × 0.00060) = $0.025 for 50 whops
# Per whop = $0.025 / 50 = $0.0005
# Projected for 8,000 = $0.0005 × 8,000 = $4
```

**Check rejects** (should be 0):
```bash
wc -l data/content/rejects.jsonl
```

---

### 5️⃣ Full Production Run (8K whops, $50 cap)

**Terminal 1 - Run generation**:
```bash
node scripts/generate-whop-content.mjs \
  --skipFilled \
  --batch=10 \
  --limit=8000 \
  --sampleEvery=100 \
  --budgetUsd=50
```

**Terminal 2 - Monitor** (recommended):
```bash
npm run content:monitor
```

**Monitor shows**:
```
╔═══════════════════════════════════════════════════════════╗
║         WHOP CONTENT GENERATION - LIVE MONITOR           ║
╚═══════════════════════════════════════════════════════════╝

📊 Progress:
   Completed:     1,247 whops
   In Progress:   10 whops
   Output Lines:  1,247
   Success Rate:  100%

⏱️  Timing:
   Elapsed:       28m 34s
   Rate:          0.73 whops/sec
   ETA:           2h 34m 12s

💰 Cost Estimate (OpenAI gpt-4o-mini):
   Tokens (est):  623,500 in, 997,600 out
   Current:       $0.6922
   Per Whop:      $0.000555
   Projected:     $4.44 (for ~8,000 total)

📝 Recent Completions:
   1. example-whop-5
   2. example-whop-4
   3. example-whop-3
   4. example-whop-2
   5. example-whop-1
```

**Wait 2-3 hours** for completion.

---

### 6️⃣ Review Results

**Check completion**:
```bash
wc -l data/content/raw/ai-run-*.jsonl
# Expected: ~8,000 lines
```

**Check rejects**:
```bash
wc -l data/content/rejects.jsonl
# Expected: 0-15 lines

# View rejects if any:
cat data/content/rejects.jsonl | jq .
```

**Check simhash state**:
```bash
cat data/content/.simhash.json | jq '.recent | length'
# Expected: 500 (or completion count if <500)
```

---

### 7️⃣ Build CSV

```bash
npm run content:build
```

**Expected output**:
```
✅ Wrote 8000 records to data/content/combined.jsonl
✅ Wrote CSV data/content/combined.csv with 8000 rows
```

**Verify CSV**:
```bash
head -2 data/content/combined.csv
# Should show header + first row
```

---

### 8️⃣ Import to BACKUP Database

```bash
# Set database URLs in .env.sync or export:
export SOURCE_DATABASE_URL="postgresql://..."

npm run content:import:backup
```

**Expected output**:
```
BEGIN
CREATE TEMP TABLE
COPY 8000
UPDATE 8000
NOTICE:  Updated rows: 8000
NOTICE:  Unmatched slugs (not in Whop): 0
COMMIT
```

---

### 9️⃣ Verify on BACKUP

```bash
psql "$SOURCE_DATABASE_URL" -c '
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "aboutContent" IS NOT NULL) AS has_about,
  COUNT(*) FILTER (WHERE "faqContent" IS NOT NULL) AS has_faq
FROM "Whop";
'
```

**Expected**:
```
 total | has_about | has_faq
-------+-----------+---------
  8000 |      8000 |    8000
```

**Spot check a few**:
```bash
psql "$SOURCE_DATABASE_URL" -c '
SELECT
  slug,
  LENGTH("aboutContent") AS about_len,
  LENGTH("faqContent") AS faq_len,
  "updatedAt"
FROM "Whop"
WHERE "aboutContent" IS NOT NULL
ORDER BY "updatedAt" DESC
LIMIT 5;
'
```

---

### 🔟 Import to PRODUCTION

```bash
export TARGET_DATABASE_URL="postgresql://..."

npm run content:import:prod
```

**Verify on PROD** (same queries as step 9).

---

## ✅ Completion Checklist

- [ ] Exported 8,000+ rows from Neon as JSONL
- [ ] Set `OPENAI_API_KEY` and model env vars
- [ ] Ran test with 50 whops, verified structure
- [ ] Ran full 8,000 with budget cap
- [ ] Checked rejects.jsonl (0-15 expected)
- [ ] Built CSV with `npm run content:build`
- [ ] Imported to BACKUP, verified counts
- [ ] Imported to PROD
- [ ] Spot-checked live data on production

---

## 🚨 Common Issues

### Issue: "No raw files found"

**Cause**: No files in `data/neon/`

**Fix**:
```bash
ls data/neon/
# Should show whops.jsonl or whops.csv
```

### Issue: "MODEL env is required"

**Cause**: Forgot to export MODEL

**Fix**:
```bash
export MODEL=gpt-4o-mini
```

### Issue: "Budget cap hit"

**Cause**: Projected cost exceeds cap (rare with gpt-4o-mini)

**Fix**: Increase cap or verify you're using gpt-4o-mini, not gpt-4o
```bash
echo $MODEL  # Should print "gpt-4o-mini"
```

### Issue: High reject rate (>1%)

**Cause**: Model not following instructions

**Fix**: Set `STRONG_MODEL` or switch to gpt-4o as base
```bash
export MODEL=gpt-4o
export STRONG_MODEL=""  # disable escalation
```

### Issue: "Unmatched slugs (not in Whop): 150"

**Cause**: Slugs in CSV don't exist in Whop table

**Fix**: Re-export from Neon with current slugs only
```sql
SELECT slug, name
FROM "Whop"
WHERE slug IN (SELECT DISTINCT slug FROM _whop_content_stage);
```

---

## 📞 Quick Commands Reference

```bash
# Monitor generation
npm run content:monitor

# Build CSV from JSONL
npm run content:build

# Import to BACKUP
npm run content:import:backup

# Import to PROD
npm run content:import:prod

# Check rejects
cat data/content/rejects.jsonl | jq .

# Clear checkpoint (restart from scratch)
rm data/content/.checkpoint.json

# Clear simhash state (new run)
rm data/content/.simhash.json

# Convert JSON array to JSONL
cat input.json | jq -c '.[]' > output.jsonl
```

---

## 💡 Pro Tips

1. **Always test first** - Run 50 whops before 8,000
2. **Monitor in parallel** - Use `npm run content:monitor` in second terminal
3. **Use budget caps** - Prevents surprise bills
4. **Check samples** - Validate structure before full run
5. **Import to BACKUP first** - Verify before PROD
6. **Save output files** - Keep `ai-run-*.jsonl` for records
7. **Review rejects** - <1% is normal, >1% investigate

---

## ⏱️ Expected Timeline

- **Export from Neon**: 5 minutes
- **Test run (50 whops)**: 2-3 minutes
- **Review samples**: 5 minutes
- **Full run (8,000 whops)**: 2-3 hours
- **Build CSV**: <1 minute
- **Import to BACKUP**: <1 minute
- **Verify**: 5 minutes
- **Import to PROD**: <1 minute

**Total**: ~3-4 hours end-to-end

---

## 💰 Final Cost

With **gpt-4o-mini**:
- Test (50 whops): ~$0.025
- Full (8,000 whops): ~$4-6
- **Total**: ~$6-7 (well under $50 cap)

**Budget breakdown**:
- Base generation: $4.50
- Repairs (~10%): +$0.50
- Escalations (~1%): +$0.20
- Similarity rewrites (~3%): included
- **Total**: ~$5.20

---

## 🎉 Success!

You now have 8,000 unique, structured whop descriptions ready for production.

**Next steps**: Enable on frontend, monitor user engagement, iterate on quality.
