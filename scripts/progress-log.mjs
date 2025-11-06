#!/usr/bin/env node
import fs from "fs";

const scope = (process.argv.find(a=>a.startsWith("--scope="))||"--scope=promo").split("=")[1];
const ck = JSON.parse(fs.readFileSync("data/content/.checkpoint.json","utf8"));

const done = Object.keys(ck.done||{}).length;
const rejected = Object.keys(ck.rejected||{}).length;

// If you already compute "eligible" and "queue" in preflight,
// you can have preflight emit a JSON blob to /tmp/preflight.json and read it here.
// For a minimal version, just log done/rejected; preflight prints the rest.
const line = [
  new Date().toISOString(),
  scope,
  done,
  rejected
].join("\t") + "\n";

fs.mkdirSync("logs", { recursive: true });
fs.appendFileSync("logs/progress.tsv", line);
console.log("Appended:", line.trim());
