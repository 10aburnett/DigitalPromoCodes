#!/usr/bin/env node

import fs from "fs";
import path from "path";

const RAW_DIR = "data/content/raw";
const OUT_DIR = "data/content";

if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const isJson = (f) => f.toLowerCase().endsWith(".json");
const isJsonl = (f) => f.toLowerCase().endsWith(".jsonl");

const files = fs.readdirSync(RAW_DIR).filter(f => isJson(f) || isJsonl(f));
if (files.length === 0) {
  console.log("No raw files found in", RAW_DIR);
  process.exit(0);
}

const REQUIRED = [
  "slug",
  "aboutcontent",
  "howtoredeemcontent",
  "promodetailscontent",
  "termscontent",
  "faqcontent",
];

const outJsonl = path.join(OUT_DIR, "combined.jsonl");
fs.writeFileSync(outJsonl, ""); // reset

let total = 0;
for (const f of files) {
  const full = path.join(RAW_DIR, f);
  const raw = fs.readFileSync(full, "utf8");

  if (isJsonl(f)) {
    // pass-thru but validate line-by-line
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let obj;
      try { obj = JSON.parse(trimmed); } catch (e) {
        console.error(`Invalid JSONL in ${f}: ${e.message}`);
        process.exit(1);
      }
      for (const k of REQUIRED) {
        if (!(k in obj)) {
          console.error(`Missing key '${k}' in ${f} line with slug='${obj.slug ?? "UNKNOWN"}'`);
          process.exit(1);
        }
      }
      fs.appendFileSync(outJsonl, JSON.stringify(obj) + "\n");
      total++;
    }
  } else if (isJson(f)) {
    // parse array
    let arr;
    try { arr = JSON.parse(raw); } catch (e) {
      console.error(`Invalid JSON in ${f}: ${e.message}`);
      process.exit(1);
    }
    if (!Array.isArray(arr)) {
      console.error(`${f} must be a JSON array`);
      process.exit(1);
    }
    for (const obj of arr) {
      for (const k of REQUIRED) {
        if (!(k in obj)) {
          console.error(`Missing key '${k}' in ${f} for slug='${obj.slug ?? "UNKNOWN"}'`);
          process.exit(1);
        }
      }
      fs.appendFileSync(outJsonl, JSON.stringify(obj) + "\n");
      total++;
    }
  }
}

console.log(`✅ Wrote ${total} records to ${outJsonl}`);
