#!/usr/bin/env node
import fs from "fs";
import { loadState } from "./lib/sets.mjs";

const CK_PATH = "data/content/.checkpoint.json";
const ck = JSON.parse(fs.readFileSync(CK_PATH, "utf8"));
ck.done ||= {};
ck.rejected ||= {};

const { needs, promo, manual, deny, done, rejected } = loadState();

const M = new Set([...manual].filter(s => promo.has(s)));
const D = new Set([...done].filter(s => promo.has(s) && !M.has(s)));
const R = new Set([...rejected].filter(s => promo.has(s) && !M.has(s)));
const DenyP = new Set([...deny].filter(s => promo.has(s)));
const accounted = new Set([...D, ...R, ...M, ...DenyP]);
const U = [...promo].filter(s => !accounted.has(s));

// Case A: not in needs → DB already has content → mark done
let promoted = 0;
for (const s of U) {
  if (!needs.has(s)) {
    ck.done[s] = { when: new Date().toISOString(), why: "db_has_content_reconcile" };
    promoted++;
  }
}

fs.writeFileSync(CK_PATH, JSON.stringify(ck, null, 2));
console.log(`Promoted ${promoted} promo slugs to done (db_has_content_reconcile).`);
