# Hub Product Overrides

This directory contains manual overrides for the semantic hub drill-down system.

## Format: `hub-product-map.json`

Maps creator hub pages to specific product URLs when automatic semantic matching fails or is ambiguous.

```json
{
  "creator-slug-or-whop-slug": "/creator/product-slug/"
}
```

### Key (string)
- **Preferred:** Creator slug (e.g., `"mf-capital"`)
- **Alternative:** Whop database slug if different from creator slug
- The script checks both forms during override lookup

### Value (string)
- **Must be:** Creator-prefixed product path (e.g., `"/mf-capital/business-toolbox/"`)
- **Must start with:** `/creator-slug/`
- **Must end with:** `/` (trailing slash)
- **Must match:** The creator prefix in the hub URL

### When to Add Overrides

Add an entry when:
1. Semantic scoring finds multiple near-equal candidates
2. The "best" candidate isn't truly the best (check `hub-review.csv`)
3. A hub page has changed and automatic matching breaks

### Example

```json
{
  "high-ticket-incubator": "/high-ticket-accelerator-p/high-ticket-accelerator-p/",
  "mf-capital": "/mf-capital/business-toolbox/"
}
```

### Audit Trail

When an override is used, it's logged to `hub-override-hits.csv` (not versioned) for verification.

### Testing After Changes

```bash
# Clean cache and re-run dry-run
rm -rf data/content/cache
env FORCE_RECRAWL=1 MODEL=gpt-4o node scripts/generate-whop-content.mjs \
  --in=data/neon/whops.jsonl --limit=50 --batch=5 --dryRun

# Check override hits
cat data/content/hub-override-hits.csv
```
