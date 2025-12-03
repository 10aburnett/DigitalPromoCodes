# Content Deduplication Guide

## Problem
AI-generated content tends to use identical or very similar phrasing across pages, which can trigger Google's duplicate content detection. This is especially problematic for:
- Opening sentences ("X promo code is available here...")
- FAQ questions ("How do I redeem?", "Is there a discount?")
- How-to-redeem steps ("Visit the official Whop listing...")
- Promo detail bullets ("Expect one code per...")

## Solution
Use the `fix-all-repetitive-content.mjs` post-processor script to slightly rephrase repeated content while keeping the exact same meaning.

## How It Works

1. **Detects repetition**: Tracks phrases that appear 3+ times across entries
2. **Preserves meaning**: Only swaps synonyms, doesn't change information
3. **Uses low temperature (0.6)**: Conservative rephrasing, not creative rewriting
4. **Processes all fields**: FAQ, how-to steps, promo details, closings

## Example Transformations

| Before | After |
|--------|-------|
| "Visit the official Whop listing" | "Go to the official Whop listing" |
| "How do I redeem access?" | "What's the process to redeem access?" |
| "Is there a discount available?" | "Are there any discounts offered?" |
| "Review the description, plan details" | "Check the description, plan specifics" |
| "Expect one code per" | "Anticipate one code per" |

## Usage

### 1. Analyze patterns first
```bash
node scripts/analyze-all-content-patterns.mjs data/content/master/successes.jsonl
```

### 2. Run deduplication
```bash
source .env.prod
node scripts/fix-all-repetitive-content.mjs data/content/master/successes.jsonl
```

Output: `successes.deduped.jsonl`

### 3. Run multiple passes if needed
Each pass reduces repetition further:
```bash
# Pass 1
node scripts/fix-all-repetitive-content.mjs successes.jsonl
cp successes.deduped.jsonl successes.jsonl

# Pass 2
node scripts/fix-all-repetitive-content.mjs successes.jsonl
cp successes.deduped.jsonl successes.jsonl
```

### 4. Verify results
```bash
node scripts/analyze-all-content-patterns.mjs successes.jsonl
```

Look for reduction in "Patterns appearing 10+ times".

## Environment Requirements

- `OPENAI_API_KEY` in `.env.prod`
- Uses `gpt-4o-mini` model
- Rate limited to ~200ms between API calls

## Scripts

- `scripts/analyze-all-content-patterns.mjs` - Detects repetitive patterns
- `scripts/fix-all-repetitive-content.mjs` - Rephrases repeated content
- `scripts/fix-duplicate-openings.mjs` - Legacy: fixes only opening sentences
- `scripts/merge-to-master.mjs` - Merges rewritten content into master

## Best Practices

1. **Always backup before processing**: Script creates automatic backups
2. **Process in batches**: For 8000+ entries, consider processing in chunks
3. **Verify after each pass**: Check that meaning is preserved
4. **Target high-repetition patterns**: Focus on patterns appearing 10+ times
5. **Don't over-process**: Some repetition is natural and expected

## Completed Work

- [x] 54 indexed pages fully deduplicated (Nov 2024)
- [ ] Remaining 8000+ pages pending deduplication
