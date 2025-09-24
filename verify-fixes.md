# Verification Scripts for DevTools Console

## A. Test neighbors.json is served fresh and contains slugs:

```javascript
// Test normal ASCII hyphen slug
await fetch('/data/graph/neighbors.json', {cache:'no-store'})
  .then(r=>r.json())
  .then(g => console.log('has website-master?', !!g['website-master'], g['website-master']));

// Test colon slug
await fetch('/data/graph/neighbors.json', {cache:'no-store'})
  .then(r=>r.json())
  .then(g => console.log('has ayecon-academy-1:1-mentorship?', !!g['ayecon-academy-1:1-mentorship'], g['ayecon-academy-1:1-mentorship']));
```

## B. Test API paths are not double-encoded:

```javascript
// Test normal slug
fetch('/api/whops/website-master/recommendations')
  .then(r=>console.log('website-master status should be 200:', r.status));

// Test colon slug (properly encoded once)
fetch('/api/whops/ayecon-academy-1%3a1-mentorship/recommendations')
  .then(r=>console.log('ayecon (single encode) status should be 200:', r.status));

// Test double-encoded (should fail)
fetch('/api/whops/ayecon-academy-1%253a1-mentorship/recommendations')
  .then(r=>console.log('ayecon (double encode) status should be 404:', r.status));
```

## C. Test batch API:

```javascript
// Test batch with proper encoding
fetch('/api/whops/batch?slugs=ayecon-academy-monthly-mentorship,tbm-bsm,1-academy,1-on-1-funded-in-30')
  .then(r=>r.json())
  .then(j => console.log('batch count:', Array.isArray(j.whops) ? j.whops.length : 0));
```

## Expected Results:

All should return true/200/4:
- ✅ has website-master? true
- ✅ has ayecon-academy-1:1-mentorship? true
- ✅ website-master status should be 200: 200
- ✅ ayecon (single encode) status should be 200: 200
- ❌ ayecon (double encode) status should be 404: 404
- ✅ batch count: 4

If all pass, the fix is working!