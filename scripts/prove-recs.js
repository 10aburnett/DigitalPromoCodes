// node scripts/prove-recs.js website-master
const fs = require('fs');
const slug = process.argv[2];
if (!slug) { console.error('Usage: node scripts/prove-recs.js <slug>'); process.exit(1); }

const g = JSON.parse(fs.readFileSync('public/data/graph/neighbors.json','utf8'));
const recs = g?.[slug]?.recommendations || [];
console.log('Graph recs:', recs);

if (!recs.length) {
  console.log('❌ Graph has no recs for slug.');
  process.exit(0);
}

const encoded = recs.filter(Boolean).slice(0,12).map(s => encodeURIComponent(s)).join(',');
const base = 'http://localhost:3001';
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

(async () => {
  try {
    const r = await fetch(`${base}/api/whops/batch?slugs=${encoded}`);
    console.log('Batch status:', r.status);
    const j = await r.json();
    console.log('Batch count:', Array.isArray(j.whops) ? j.whops.length : 0);
    if (!Array.isArray(j.whops) || j.whops.length === 0) {
      console.log('Trying per-slug salvage…');
      let ok = 0;
      for (const s of recs) {
        const rr = await fetch(`${base}/api/whops/${encodeURIComponent(s)}`);
        if (rr.ok) ok++;
      }
      console.log('Per-slug successes:', ok);
    }
  } catch (e) {
    console.error('Batch error:', e);
  }
})();