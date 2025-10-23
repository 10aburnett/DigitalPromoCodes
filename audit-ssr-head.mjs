// audit-ssr-head.mjs
import https from "https";
import http from "http";
import { URL } from "url";

function fetchRaw(url) {
  const u = new URL(url);
  const lib = u.protocol === "https:" ? https : http;
  const opts = {
    method: "GET",
    headers: { "User-Agent": "SSR-Head-Audit/1.0 (Googlebot-lite)" }
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(u, opts, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

function has(pattern, html) {
  return new RegExp(pattern, "i").test(html);
}

function extractJsonLd(html) {
  const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  return m ? m.length : 0;
}

function extractMetaContent(pattern, html) {
  const m = html.match(new RegExp(pattern, "i"));
  return m ? m[1].substring(0, 60) : "";
}

(async () => {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.error("Usage: node audit-ssr-head.mjs <url1> <url2> ...");
    console.error("\nExample:");
    console.error("  node audit-ssr-head.mjs http://localhost:3000/whop/example-slug");
    console.error("  node audit-ssr-head.mjs https://whpcodes.com/whop/slug1 https://whpcodes.com/whop/slug2");
    process.exit(1);
  }

  console.log("url,status,desc,canonical,og,twitter,jsonld_count,title,notes");

  for (const url of urls) {
    try {
      const { status, data: html } = await fetchRaw(url);
      const desc = has(`<meta\\s+name=["']description["']\\s+content=`, html);
      const canonical = has(`<link\\s+rel=["']canonical["']\\s+href=`, html);
      const og = has(`<meta\\s+property=["']og:`, html);
      const tw = has(`<meta\\s+name=["']twitter:`, html);
      const jsonldCount = extractJsonLd(html);
      const title = extractMetaContent(`<title[^>]*>([^<]+)</title>`, html);
      const descContent = extractMetaContent(`<meta\\s+name=["']description["']\\s+content=["']([^"']+)["']`, html);
      const robotsMeta = extractMetaContent(`<meta\\s+name=["']robots["']\\s+content=["']([^"']+)["']`, html);

      let notes = '';
      if (status !== 200) notes = `status:${status}`;
      if (robotsMeta.includes('noindex')) notes += (notes ? '|' : '') + 'noindex';
      if (title.includes('Not Found') || title.includes('No Longer Available')) {
        notes += (notes ? '|' : '') + 'retired/404_title';
      }
      if (descContent.includes('retired') || descContent.includes('not available')) {
        notes += (notes ? '|' : '') + 'retired_desc';
      }

      console.log(`${url},${status},${desc},${canonical},${og},${tw},${jsonldCount},"${title.replace(/"/g, '\\"')}",${notes || 'OK'}`);
    } catch (e) {
      console.log(`${url},error,false,false,false,false,0,"",${e.message.replace(/,/g, ';')}`);
    }
  }
})();
