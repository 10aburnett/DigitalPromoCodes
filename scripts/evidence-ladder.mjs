import fetch from "node-fetch";

// util
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const HOST = (u) => { try { return new URL(u).hostname; } catch { return ""; } };

// 1) JS render (Playwright) — optional, only if ENABLE_JS_RENDER=1
export async function renderWithJS(url) {
  if (process.env.ENABLE_JS_RENDER !== "1") return { ok:false, why:"js_render_disabled" };
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ userAgent: process.env.SCRAPE_UA || undefined });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: +(process.env.PROBE_TIMEOUT_MS||12000) });
      const html = await page.content();
      return { ok:true, html, url: page.url(), host: HOST(page.url()), source:"js_render" };
    } finally {
      await browser.close();
    }
  } catch (e) {
    return { ok:false, why:"js_render_fail", error: String(e) };
  }
}

// 2) Canonical / hreflang hop
export function extractAlternateUrls(html, baseUrl) {
  const rel = (re, multi=false) => {
    const out = [];
    const rx = new RegExp(`<link[^>]+${re}[^>]*>`, "ig");
    let m; while ((m = rx.exec(html))) out.push(m[0]);
    return out;
  };
  const canon = rel('rel=["\']?canonical["\']?');
  const href = (tag) => {
    const m = tag.match(/href=["']([^"']+)["']/i);
    if (!m) return null;
    try { return new URL(m[1], baseUrl).toString(); } catch { return null; }
  };
  const canonUrl = canon.map(href).find(Boolean);
  const altHreflangs = rel('rel=["\']?alternate["\']?[^>]+hreflang=').map(href).filter(Boolean);
  return { canonUrl, altHreflangs };
}

// 3) Wayback fallback (latest snapshot)
export async function fetchWaybackSnapshot(url) {
  try {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&filter=statuscode:200&from=2022`;
    const list = await (await fetch(cdx)).json();
    if (!Array.isArray(list) || list.length < 2) return { ok:false, why:"no_wayback" };
    const last = list[list.length-1]; // [urlkey,timestamp,original,mimetype,statuscode,digest,length]
    const ts = last[1];
    const wb = `https://web.archive.org/web/${ts}/${url}`;
    const html = await (await fetch(wb)).text();
    return { ok:true, html, url: wb, host: HOST(url), source:"wayback" };
  } catch (e) {
    return { ok:false, why:"wayback_error", error: String(e) };
  }
}

// 4) Social bio/portal fallback (very light: og:description + title)
export async function fetchSocialBio(urlOrHost) {
  const host = urlOrHost.includes("://") ? HOST(urlOrHost) : urlOrHost;
  // very conservative list
  const candidates = [
    `https://linktr.ee/${host.split(".")[0]}`,
    `https://x.com/${host.split(".")[0]}`,
    `https://instagram.com/${host.split(".")[0]}`,
    `https://youtube.com/@${host.split(".")[0]}`
  ];
  for (const u of candidates) {
    try {
      const res = await fetch(u, { timeout: +(process.env.PROBE_TIMEOUT_MS||12000) });
      if (!res.ok) continue;
      const html = await res.text();
      const ogd = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
      const text = [title, ogd].filter(Boolean).join(". ");
      if (text.length > 30) return { ok:true, html: `<p>${text}</p>`, url: u, host: HOST(u), source:"social_bio" };
    } catch {}
  }
  return { ok:false, why:"no_social_bio" };
}

// orchestrator: climb the ladder until we have enough chars
export async function climbEvidenceLadder(baseUrl, html0, minChars=300) {
  const plainTextLen = (h) => (h||"").replace(/<script[\s\S]*?<\/script>/ig,"")
                                     .replace(/<style[\s\S]*?<\/style>/ig,"")
                                     .replace(/<[^>]+>/g,"")
                                     .trim().length;

  let html = html0, url = baseUrl, host = HOST(baseUrl), source = "direct";
  if ((plainTextLen(html) || 0) >= minChars) return { ok:true, html, url, host, source };

  console.log(`📶 Evidence ladder: initial ${plainTextLen(html)} chars < ${minChars}, climbing...`);

  // JS render
  const js = await renderWithJS(baseUrl);
  if (js.ok && plainTextLen(js.html) >= minChars) {
    console.log(`📶 Evidence ladder: JS render success (${plainTextLen(js.html)} chars)`);
    return js;
  }

  // canonical/hreflang
  if (html) {
    const { canonUrl, altHreflangs } = extractAlternateUrls(html, baseUrl);
    const tryFetch = async (u) => {
      try {
        const t = await (await fetch(u, { timeout: +(process.env.PROBE_TIMEOUT_MS||12000) })).text();
        return { u, t };
      } catch {
        return null;
      }
    };
    if (canonUrl) {
      const r = await tryFetch(canonUrl);
      if (r && plainTextLen(r.t) >= minChars) {
        console.log(`📶 Evidence ladder: canonical URL success (${plainTextLen(r.t)} chars)`);
        return { ok:true, html:r.t, url: r.u, host: HOST(r.u), source:"canonical" };
      }
    }
    for (const a of altHreflangs) {
      const r = await tryFetch(a);
      if (r && plainTextLen(r.t) >= minChars) {
        console.log(`📶 Evidence ladder: hreflang success (${plainTextLen(r.t)} chars)`);
        return { ok:true, html:r.t, url: r.u, host: HOST(r.u), source:"hreflang" };
      }
    }
  }

  // Wayback
  const wb = await fetchWaybackSnapshot(baseUrl);
  if (wb.ok && plainTextLen(wb.html) >= Math.min(minChars, 180)) {
    console.log(`📶 Evidence ladder: Wayback success (${plainTextLen(wb.html)} chars)`);
    return wb;
  }

  // Social bio
  const bio = await fetchSocialBio(baseUrl);
  if (bio.ok) {
    console.log(`📶 Evidence ladder: social bio success`);
    return bio;
  }

  console.log(`📶 Evidence ladder: exhausted all options`);
  return { ok:false, why:"ladder_exhausted" };
}
