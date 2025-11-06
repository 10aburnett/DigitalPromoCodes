#!/usr/bin/env node
import fs from "fs";

const scope = (process.argv.find(a=>a.startsWith("--scope="))||"--scope=promo").split("=")[1];
const ck = JSON.parse(fs.readFileSync("data/content/.checkpoint.json","utf8"));

const done = Object.keys(ck.done||{}).length;
const rejected = Object.keys(ck.rejected||{}).length;

// Read queue/eligible from preflight summary
let queue = "";
let eligible = "";
try {
  const s = JSON.parse(fs.readFileSync("/tmp/preflight-summary.json","utf8"));
  queue = String(s.unaccounted ?? "");
  // Eligible = remaining work candidates; for now we just mirror queue (simple, monotonic)
  eligible = queue;
} catch {}

// Create logs directory and TSV header if needed
if (!fs.existsSync("logs")) fs.mkdirSync("logs", { recursive: true });
if (!fs.existsSync("logs/progress.tsv")) {
  fs.writeFileSync("logs/progress.tsv", "ts\tscope\tdone\trejected\teligible\tqueue\n");
}

const line = [
  new Date().toISOString(),
  scope,
  done,
  rejected,
  eligible,
  queue
].join("\t") + "\n";

fs.appendFileSync("logs/progress.tsv", line);
console.log("Appended:", line.trim());
