#!/usr/bin/env node

import fs from "fs";
import path from "path";

const IN = "data/content/combined.jsonl";
const OUT = "data/content/combined.csv";

if (!fs.existsSync(IN)) {
  console.error(`Missing ${IN}. Run: npm run content:jsonify`);
  process.exit(1);
}

const REQUIRED = [
  "slug",
  "aboutcontent",
  "howtoredeemcontent",
  "promodetailscontent",
  "termscontent",
  "faqcontent",
];

// CSV escaper
const esc = (v) => {
  const s = (v ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const lines = fs.readFileSync(IN, "utf8").split(/\r?\n/).filter(Boolean);

const rows = [];
for (const line of lines) {
  let obj;
  try { obj = JSON.parse(line); } catch (e) {
    console.error("Invalid JSONL line:", e.message);
    process.exit(1);
  }
  for (const k of REQUIRED) {
    if (!(k in obj)) {
      console.error(`Missing key '${k}' for slug='${obj.slug ?? "UNKNOWN"}'`);
      process.exit(1);
    }
  }

  // Light trims
  for (const k of REQUIRED) {
    if (typeof obj[k] === "string") {
      obj[k] = obj[k].trim();
    }
  }

  rows.push([
    obj.slug,
    obj.aboutcontent,
    obj.howtoredeemcontent,
    obj.promodetailscontent,
    obj.termscontent,
    obj.faqcontent,
  ]);
}

let out = "slug,aboutcontent,howtoredeemcontent,promodetailscontent,termscontent,faqcontent\n";
for (const r of rows) {
  out += r.map(esc).join(",") + "\n";
}
fs.writeFileSync(OUT, out);
console.log(`✅ Wrote CSV ${OUT} with ${rows.length} rows`);
