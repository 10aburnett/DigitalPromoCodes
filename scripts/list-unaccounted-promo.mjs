#!/usr/bin/env node
import fs from "fs";
import { loadState, PROMO_FILE } from "./lib/sets.mjs";

const { needs, promo, manual, deny, done, rejected } = loadState();

// promo-aware partitions
const M = new Set([...manual].filter(s => promo.has(s)));
const D = new Set([...done].filter(s => promo.has(s) && !M.has(s)));
const R = new Set([...rejected].filter(s => promo.has(s) && !M.has(s)));
const DenyP = new Set([...deny].filter(s => promo.has(s)));
const accounted = new Set([...D, ...R, ...M, ...DenyP]);

// U = promo − accounted
const U = [...promo].filter(s => !accounted.has(s));

// Print with reason wrt DB needs list
console.log(`Unaccounted in promo (U): ${U.length}`);
for (const s of U) {
  const inNeeds = needs.has(s);
  const reason = inNeeds ? "needs-content" : "db-already-has-content";
  console.log(`${s}\t${reason}`);
}
