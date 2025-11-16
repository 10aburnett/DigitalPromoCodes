#!/usr/bin/env node
/**
 * Streaming JSONL → CSV exporter for successes.jsonl
 * - Memory-safe (line-by-line)
 * - Proper CSV quoting
 * - Deterministic column order
 *
 * Usage:
 *   node scripts/successes-jsonl-to-csv.mjs \
 *     --in=data/content/master/successes.jsonl \
 *     --out=exports/successes-YYYYMMDD.csv
 */

import fs from "fs";
import readline from "readline";
import path from "path";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.split("=");
      return [k.replace(/^--/, ""), v ?? true];
    })
  );
  if (!args.in || !args.out) {
    console.error("Usage: node scripts/successes-jsonl-to-csv.mjs --in=... --out=...");
    process.exit(1);
  }
  return args;
}

// Minimal CSV escaper (RFC4180-ish)
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

// Normalize HTML blocks (optional: keep as-is if your backend expects raw)
function normalizeHtml(html) {
  if (html == null) return "";
  // Preserve content; just ensure CRLFs don't sneak in
  return String(html).replace(/\r\n/g, "\n");
}

function pickRow(obj) {
  // Choose exactly what your backend expects. Add/remove fields as needed.
  return {
    slug: obj.slug ?? "",
    finalUrl: obj.finalUrl ?? obj.evidence?.finalUrl ?? "",

    aboutcontent: normalizeHtml(obj.aboutcontent),
    howtoredeemcontent: normalizeHtml(obj.howtoredeemcontent),
    promodetailscontent: normalizeHtml(obj.promodetailscontent),
    termscontent: normalizeHtml(obj.termscontent),

    // Store FAQs as JSON string so backend can JSON.parse → JSONB
    faqcontent: obj.faqcontent ? JSON.stringify(obj.faqcontent) : "[]",

    // Optional diagnostics
    model: obj.model ?? "",
    generated_at: obj.ts ?? obj.generated_at ?? "", // e.g. ISO string if present
  };
}

async function main() {
  const { in: inputFile, out: outputFile } = parseArgs();

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  const inStream = fs.createReadStream(inputFile, { encoding: "utf8" });
  const rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });
  const out = fs.createWriteStream(outputFile, { encoding: "utf8" });

  const headers = [
    "slug",
    "finalUrl",
    "aboutcontent",
    "howtoredeemcontent",
    "promodetailscontent",
    "termscontent",
    "faqcontent",
    "model",
    "generated_at",
  ];
  out.write(headers.map(csvEscape).join(",") + "\n");

  let total = 0, written = 0, bad = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    total++;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      bad++;
      continue;
    }
    if (!obj.slug) { bad++; continue; }

    const row = pickRow(obj);
    const rowValues = headers.map(h => csvEscape(row[h]));
    out.write(rowValues.join(",") + "\n");
    written++;
  }

  out.end();
  await new Promise(r => out.on("close", r));

  console.log(`Input lines: ${total}`);
  console.log(`Rows written: ${written}`);
  console.log(`Skipped/bad: ${bad}`);
  console.log(`CSV: ${outputFile}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
