const fs = require('fs');
const g = JSON.parse(fs.readFileSync('public/data/graph/neighbors.json','utf8'));

let bad = 0;
for(const [slug, n] of Object.entries(g)) {
  if(n.recommendations) {
    const invalid = n.recommendations.filter(r => !r || r.length < 2 || r === '-');
    if(invalid.length > 0) {
      bad++;
      if(bad <= 5) console.log(slug + ':', n.recommendations);
    }
  }
}
console.log('Total with invalid recs:', bad);