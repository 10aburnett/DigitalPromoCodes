#!/usr/bin/env node
/**
 * 🏆 GOLDEN SCRUB PROMO DESCRIPTIONS — Remove literal codes from descriptions
 * Prevents affiliate cookie bypass by ensuring codes only visible via "Reveal code"
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), ".env.sync") });

const DRY = process.argv.includes("--dry") || process.argv.includes("-n");

// Allow DATABASE_URL override or use from .env.sync
const DB_URL = process.env.DATABASE_URL || process.env.SOURCE_DATABASE_URL;
if (!DB_URL) {
  console.error("❌ No DATABASE_URL found. Set it or ensure .env.sync has SOURCE_DATABASE_URL");
  process.exit(1);
}

const db = new PrismaClient({
  datasources: { db: { url: DB_URL } }
});

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function scrub(desc, code) {
  if (!desc) return desc;
  const codeRe = new RegExp(`\\b${escapeRegExp(code)}\\b`, "gi");

  let out = desc;

  // 1) Remove the exact code
  out = out.replace(codeRe, "");

  // 2) Remove "with/using/use (promo) code:"
  out = out.replace(
    /\b(with|using|use|apply|enter)\s+(promo\s*)?code\b[:\-]?\s*/gi,
    ""
  );
  // Also generic leftovers like "promo code" if it stands alone
  out = out.replace(/\b(promo\s*)?code\b[:\-]?\s*/gi, "");

  // 3) Collapse multiple spaces and fix punctuation spacing
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?:])/g, "$1")
    .replace(/(^\s+|\s+$)/g, "");

  // 4) If we emptied it, fall back to a generic description
  if (!out) out = "Get this discount on the offer.";

  return out;
}

(async () => {
  console.log(`🔧 Scrubbing promo codes from PromoCode.description (${DRY ? "DRY-RUN" : "LIVE"})`);
  console.log();

  // Ensure a simple backup table exists
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromoCodeDescriptionBackup" (
      id text PRIMARY KEY,
      description text,
      backed_up_at timestamptz default now()
    );
  `);

  const promos = await db.promoCode.findMany({
    select: { id: true, code: true, description: true, title: true },
  });

  let toChange = [];
  for (const p of promos) {
    const cleaned = scrub(p.description ?? "", p.code ?? "");
    if (cleaned !== (p.description ?? "")) {
      toChange.push({ id: p.id, before: p.description ?? "", after: cleaned, code: p.code });
    }
  }

  console.log(`• Found ${toChange.length} descriptions to update out of ${promos.length}`);
  console.log();

  if (DRY) {
    console.log("Sample changes (first 10):");
    toChange.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.code}]`);
      console.log(`     BEFORE: ${r.before}`);
      console.log(`     AFTER : ${r.after}`);
      console.log();
    });
    console.log("🧪 DRY-RUN complete — no changes written.");
    await db.$disconnect();
    return;
  }

  // Backup originals (UPSERT in case re-run)
  console.log("📦 Backing up original descriptions...");
  for (const chunk of chunker(toChange, 500)) {
    const values = chunk
      .map(
        r =>
          `('${r.id.replace(/'/g, "''")}', ${r.before == null ? "NULL" : "'" + r.before.replace(/'/g, "''") + "'"}, now())`
      )
      .join(",\n");
    await db.$executeRawUnsafe(`
      INSERT INTO "PromoCodeDescriptionBackup"(id, description, backed_up_at)
      VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, backed_up_at = now();
    `);
  }

  // Apply updates
  console.log("✍️  Applying scrubbed descriptions...");
  let updated = 0;
  for (const chunk of chunker(toChange, 200)) {
    await db.$transaction(
      chunk.map(r =>
        db.promoCode.update({
          where: { id: r.id },
          data: { description: r.after, updatedAt: new Date() },
        })
      ),
      { timeout: 60000 }
    );
    updated += chunk.length;
    console.log(`   Updated ${updated}/${toChange.length}`);
  }

  console.log();
  console.log("✅ Scrub complete!");
  console.log("   Backup table: PromoCodeDescriptionBackup");
  console.log("   To rollback: UPDATE \"PromoCode\" p SET description = b.description FROM \"PromoCodeDescriptionBackup\" b WHERE p.id = b.id;");
  await db.$disconnect();
})().catch(async e => {
  console.error("💥 Scrub failed:", e);
  try { await db.$disconnect(); } catch {}
  process.exit(1);
});

function* chunker(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
