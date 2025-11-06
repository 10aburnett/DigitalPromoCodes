#!/usr/bin/env node
/**
 * Reconcile current promo coverage with strict set logic.
 * Idempotent; writes explicit artifact files for inspection.
 *
 * Files written:
 *   /tmp/promo-all.txt                 (P) current promo slugs in DB
 *   /tmp/promo-manual.txt              (M) manual slugs (if file exists)
 *   /tmp/promo-done.txt                (D) checkpoint done
 *   /tmp/promo-rejected.txt            (R) checkpoint rejected
 *   /tmp/promo-ai-tracked.txt          (T) = (D ∪ R) ∩ P
 *   /tmp/promo-unaccounted.txt         (U) = P \ (T ∪ M)
 *   /tmp/promo-drift-tracked.txt       (D∪R) \ P  (explains "extra" items)
 *
 * Prints a precise tally and validates: |P| = |T| + |M| + |U|
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CK_PATH = "data/content/.checkpoint.json";
const MANUAL_PATH = "data/manual/promo-manual-content.txt";

// ---------- helpers ----------
function readLines(p) {
  try {
    return fs.readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
function writeLines(p, arr) {
  fs.writeFileSync(p, arr.join("\n") + (arr.length ? "\n" : ""));
}
function toSet(arr) { return new Set(arr); }
function setUnion(A, B) { const s = new Set(A); for (const x of B) s.add(x); return s; }
function setInter(A, B) { const s = new Set(); for (const x of A) if (B.has(x)) s.add(x); return s; }
function setDiff(A, B) { const s = new Set(); for (const x of A) if (!B.has(x)) s.add(x); return s; }

async function main() {
  // P: current promo whops (ground truth now)
  const promoRows = await prisma.whop.findMany({
    where: { PromoCode: { some: {} } },
    select: { slug: true },
  });
  const P = toSet(promoRows.map(r => r.slug));

  // M: manual (from file). If missing, treat as empty but keep count override if needed.
  const manualList = readLines(MANUAL_PATH);
  const M = toSet(manualList);
  const manualCountOverride = Number(process.env.MANUAL_PROMO_COUNT || ""); // optional fallback (e.g., 33)

  // Checkpoint
  const ck = JSON.parse(fs.readFileSync(CK_PATH, "utf8"));
  const D = toSet(Object.keys(ck.done || {}));
  const R = toSet(Object.keys(ck.rejected || {}));
  const DR = setUnion(D, R);

  // T: AI-tracked promos only (remove drift by intersecting with P)
  const T = setInter(DR, P);

  // U: Unaccounted promos (need generation)
  // If we have an actual M list, use the set; else use count only (best-effort).
  let U;
  let identityHolds;
  if (M.size > 0) {
    U = setDiff(P, setUnion(T, M));
    identityHolds = (P.size === (T.size + M.size + U.size));
  } else {
    // No manual list; use override count for the equation, but we cannot produce U per-slug.
    const mCount = Number.isFinite(manualCountOverride) && manualCountOverride > 0
      ? manualCountOverride
      : 0;
    U = null; // unknown without list
    identityHolds = (P.size === (T.size + mCount + 0 /*unknown U*/));
  }

  // Drift: tracked but no longer promo now
  const drift = setDiff(DR, P);

  // Write artifacts
  writeLines("/tmp/promo-all.txt", [...P].sort());
  if (M.size > 0) writeLines("/tmp/promo-manual.txt", [...M].sort());
  writeLines("/tmp/promo-done.txt", [...D].sort());
  writeLines("/tmp/promo-rejected.txt", [...R].sort());
  writeLines("/tmp/promo-ai-tracked.txt", [...T].sort());
  writeLines("/tmp/promo-drift-tracked.txt", [...drift].sort());
  if (U) writeLines("/tmp/promo-unaccounted.txt", [...U].sort());

  // Report
  console.log("=== PROMO RECONCILIATION (sets) ===");
  console.log(`Promo (P) in DB now:           ${P.size}`);
  console.log(`Done (D) in ck:                 ${D.size}`);
  console.log(`Rejected (R) in ck:             ${R.size}`);
  console.log(`Tracked (D∪R):                  ${DR.size}`);
  console.log(`AI-tracked promos T=(D∪R)∩P:    ${T.size}`);
  console.log(`Drift tracked ((D∪R)\\P):       ${drift.size}`);
  if (M.size > 0) {
    console.log(`Manual (M) from file:           ${M.size}`);
    console.log(`Unaccounted promos (U):         ${U.size}`);
    console.log(`Identity check: |P| ?= |T| + |M| + |U|  →  ${P.size} ?= ${T.size} + ${M.size} + ${U.size}`);
    console.log(identityHolds ? "✅ Identity holds exactly." : "❌ Identity FAILS. Inspect artifacts in /tmp.");
  } else {
    const mc = Number.isFinite(manualCountOverride) && manualCountOverride > 0 ? manualCountOverride : 0;
    console.log(`Manual count (env fallback):    ${mc}`);
    console.log("Unaccounted promos (U):         unknown (no manual list provided)");
    console.log(`Check (numeric only): |P| ?≈ |T| + manualCount → ${P.size} ?≈ ${T.size} + ${mc}`);
    console.log("⚠️ Provide data/manual/promo-manual-content.txt to compute U and full identity.");
  }
}

main().catch(e => { console.error(e); process.exit(1); })
       .finally(async () => { await prisma.$disconnect(); });
