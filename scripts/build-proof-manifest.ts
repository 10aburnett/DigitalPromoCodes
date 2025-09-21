#!/usr/bin/env ts-node

import fs from "fs";
import path from "path";
import { fileSlug } from "../src/lib/slug-utils";

const VERSION = process.env.PROOF_VERSION || "2025-09";     // <— easy to bump later
const dir = path.join(process.cwd(), "public", "images", "howto");

// accept -proof-YYYY-MM.(webp|png)
const fileRe = new RegExp(`-proof-${VERSION}\\.(webp|png)$`, "i");

const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => fileRe.test(f));
const slugs = files.map(f => fileSlug(f.replace(fileRe, "")));
const out = { updatedAt: new Date().toISOString(), version: VERSION, slugs };

const outPath = path.join(process.cwd(), "data", "proof-manifest.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.slugs.length} slugs → data/proof-manifest.json (v${VERSION})`);