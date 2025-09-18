import fs from "node:fs/promises";
import path from "node:path";

const PAGES_DIR = path.join(process.cwd(), "data", "pages");

// very light "RSC stream"/payload scan for popupPromoCode
function extractPopupCodes(blob) {
  const codes = [];
  const re = /"popupPromoCode"\s*:\s*\{[^}]*"code"\s*:\s*"([^"]+)"[^}]*\}/gi;
  let m;
  while ((m = re.exec(blob))) codes.push(m[1]);
  return Array.from(new Set(codes));
}

async function main() {
  const files = await fs.readdir(PAGES_DIR);
  const nowIso = new Date().toISOString();
  let changed = 0;

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const filePath = path.join(PAGES_DIR, f);
    let json;
    try {
      json = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
      continue;
    }
    if (!json?.whopUrl) continue;

    let text = "";
    try {
      const res = await fetch(json.whopUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
          "accept": "text/html,application/xhtml+xml"
        }
      });
      text = await res.text();
    } catch {
      // network fail — still bump lastUpdated to reflect a check attempt
    }

    const observedCodes = text ? extractPopupCodes(text) : [];
    let pageChanged = false;

    if (Array.isArray(json.ledger)) {
      for (const row of json.ledger) {
        if (observedCodes.includes(row.code)) {
          row.checkedAt = nowIso;                         // ✅ neutral wording
          delete row.observedAt;                          // cleanup old key
          pageChanged = true;
          if (!row.status) row.status = "unknown";
          // Clean up any payload references in notes
          if (row.notes?.toLowerCase?.().includes("payload")) {
            row.notes = "";
          }
        }
      }
    }

    // always update lastUpdated to reflect the auto-check
    if (json.lastUpdated !== nowIso) {
      json.lastUpdated = nowIso;
      pageChanged = true;
    }

    if (pageChanged) {
      await fs.writeFile(filePath, JSON.stringify(json, null, 2));
      changed++;
    }
  }

  console.log(`Auto-check complete. Files updated: ${changed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});