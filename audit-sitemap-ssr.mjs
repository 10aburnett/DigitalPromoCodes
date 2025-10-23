// audit-sitemap-ssr.mjs
import fs from "fs/promises";
import https from "https";
import http from "http";
import { spawn } from "node:child_process";

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    lib.get(url, { headers: { "User-Agent": "SSR-Head-Audit/1.0" } }, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

const runAudit = urls => new Promise((resolve) => {
  const child = spawn(process.execPath, ["audit-ssr-head.mjs", ...urls], {
    stdio: ["ignore", "pipe", "inherit"]
  });
  let out = "";
  child.stdout.on("data", d => out += d);
  child.on("close", () => resolve(out.trim()));
});

(async () => {
  const sitemapUrl = process.argv[2];
  if (!sitemapUrl) {
    console.error("Usage: node audit-sitemap-ssr.mjs <sitemap-url>");
    console.error("\nExample:");
    console.error("  node audit-sitemap-ssr.mjs http://localhost:3000/sitemap.xml");
    console.error("  node audit-sitemap-ssr.mjs https://whpcodes.com/sitemap.xml");
    process.exit(1);
  }

  console.log(`Fetching sitemap from ${sitemapUrl}...`);
  const xml = await get(sitemapUrl);

  // Simple regex extraction (works without xmldom dependency)
  const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
  const allUrls = locMatches.map(m => m[1].trim());

  // Filter to whop pages only (or include all - adjust as needed)
  const whopUrls = allUrls.filter(u => /\/whop\//.test(u));

  console.log(`Found ${allUrls.length} total URLs, ${whopUrls.length} whop pages`);
  console.log(`Sampling first 50 whop pages for audit...\n`);

  const sample = whopUrls.slice(0, 50);
  const csv = await runAudit(sample);

  await fs.writeFile("ssr-head-audit.csv", csv + "\n");
  console.log(`\n✅ Wrote ssr-head-audit.csv with ${sample.length} rows`);

  // Summary stats
  const lines = csv.split('\n').filter(l => l && !l.startsWith('url,'));
  const okCount = lines.filter(l => l.endsWith(',OK')).length;
  const issueCount = lines.length - okCount;

  console.log(`\n📊 Summary:`);
  console.log(`  ✅ OK: ${okCount}`);
  console.log(`  ⚠️  Issues: ${issueCount}`);

  if (issueCount > 0) {
    console.log(`\n⚠️  Pages with issues:`);
    lines.filter(l => !l.endsWith(',OK')).slice(0, 10).forEach(l => {
      const url = l.split(',')[0];
      const notes = l.split(',').pop();
      console.log(`  - ${url} → ${notes}`);
    });
  }
})();
