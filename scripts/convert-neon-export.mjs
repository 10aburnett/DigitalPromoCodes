#!/usr/bin/env node
/**
 * Convert Neon export (JSON array or CSV) → JSONL at data/neon/whops.jsonl
 *
 * Usage:
 *   node scripts/convert-neon-export.mjs --in=data/neon/whops.json
 *   node scripts/convert-neon-export.mjs --in=data/neon/whops.csv
 */

import fs from "fs";
import path from "path";

const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const m=a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a,true];
}));

const IN = args.in || "data/neon/whops.json";
const OUT = "data/neon/whops.jsonl";

function ensureDirs() {
  if (!fs.existsSync("data/neon")) fs.mkdirSync("data/neon", { recursive: true });
}
ensureDirs();

if (!fs.existsSync(IN)) {
  console.error(`❌ Input not found: ${IN}`);
  process.exit(1);
}

const ext = path.extname(IN).toLowerCase();

async function csvToJsonl(csvText) {
  // Try to use csv-parse/sync if available (best for edge cases)
  try {
    const mod = await import("csv-parse/sync");
    const { parse } = mod;
    const records = parse(csvText, { columns: true, skip_empty_lines: true });
    return records.map(r => JSON.stringify(r)).join("\n");
  } catch {
    console.error("❌ csv-parse/sync not found. Install it:\n   npm i csv-parse");
    process.exit(1);
  }
}

async function jsonArrayToJsonl(jsonText) {
  let arr;
  try {
    arr = JSON.parse(jsonText);
    if (!Array.isArray(arr)) throw new Error("JSON must be an array of objects");
  } catch (e) {
    console.error("❌ Invalid JSON array:", e.message);
    process.exit(1);
  }
  return arr.map(r => JSON.stringify(r)).join("\n");
}

const txt = fs.readFileSync(IN, "utf8");
let jsonl;

if (ext === ".json") {
  jsonl = await jsonArrayToJsonl(txt);
} else if (ext === ".csv") {
  jsonl = await csvToJsonl(txt);
} else {
  console.error("❌ Input must be .json or .csv");
  process.exit(1);
}

fs.writeFileSync(OUT, jsonl);
console.log(`✅ Wrote ${OUT} with ${jsonl.split(/\r?\n/).filter(Boolean).length} rows`);
