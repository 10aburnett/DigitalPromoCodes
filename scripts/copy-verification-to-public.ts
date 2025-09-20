// scripts/copy-verification-to-public.ts
import fs from "fs";
import path from "path";

const src = path.join(process.cwd(), "data", "pages");
const dst = path.join(process.cwd(), "public", "data", "pages");

fs.mkdirSync(dst, { recursive: true });

for (const f of fs.readdirSync(src).filter(x => x.endsWith(".json"))) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
console.log("✅ Copied verification JSON → /public/data/pages");