#!/usr/bin/env node
/**
 * 🏆 GOLDEN SCRUB PROMO TITLES — remove literal codes from PromoCode.title
 * Protects affiliate cookie flow by ensuring codes are only revealed on click.
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), ".env.sync") });

const DRY = process.argv.includes("--dry") || process.argv.includes("-n");
const DB_URL = process.env.DATABASE_URL || process.env.SOURCE_DATABASE_URL;
if (!DB_URL) {
  console.error("❌ No DATABASE_URL found. Set it or ensure .env.sync has SOURCE_DATABASE_URL");
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** remove: exact code, any 'promo-xxxxx' token, and "(promo) code" phrasing */
function scrubTitle(title, code, whopName, displayValue) {
  if (!title) return title;

  // 1) exact code
  if (code) {
    const re = new RegExp(`\\b${escape(code)}\\b`, "gi");
    title = title.replace(re, "");
  }

  // 2) any token that looks like promo-* (defensive)
  title = title.replace(/\bpromo-[a-z0-9_]+/gi, "");

  // 3) generic "promo code …" phrasing
  title = title
    .replace(/\b(with|using|use|apply|enter)\s+(promo\s*)?code\b[:\-]?\s*/gi, "")
    .replace(/\b(promo\s*)?code\b[:\-]?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([–—\-,:;.!?])/g, "$1")
    .trim();

  // normalize leftover separators
  title = title
    // collapse spaces around dashes/colons
    .replace(/\s*([–—\-:;])\s*/g, ' $1 ')
    // collapse runs of spaces again
    .replace(/\s{2,}/g, ' ')
    // strip leading/trailing separators
    .replace(/^[–—\-:;,.!\s]+|[–—\-:;,.!\s]+$/g, '')
    .trim();

  // 4) If title collapsed to empty or just punctuation, rebuild a clean one
  if (!title || /^[-–—\s,:;.!?]+$/.test(title) || /^promo\s*[-–—]/i.test(title)) {
    const base = displayValue
      ? `${displayValue} ${whopName ?? "this offer"}`
      : `Discount on ${whopName ?? "this offer"}`;
    return base;
  }

  return title;
}

function* chunker(arr, size) { for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size); }

(async () => {
  console.log(`🔧 Scrubbing promo codes from PromoCode.title (${DRY ? "DRY-RUN" : "LIVE"})\n`);

  // tiny backup table
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromoCodeTitleBackup"(
      id text PRIMARY KEY,
      title text,
      backed_up_at timestamptz default now()
    );
  `);

  const promos = await db.promoCode.findMany({
    select: { id: true, code: true, title: true, value: true, whopId: true },
  });
  // fetch whop names once
  const whops = await db.whop.findMany({ select: { id: true, name: true } });
  const whopName = new Map(whops.map(w => [w.id, w.name]));

  const toChange = [];
  for (const p of promos) {
    const cleaned = scrubTitle(p.title ?? "", p.code ?? "", whopName.get(p.whopId), p.value ?? "");
    if (cleaned !== (p.title ?? "")) {
      toChange.push({ id: p.id, before: p.title ?? "", after: cleaned, code: p.code });
    }
  }

  console.log(`• Found ${toChange.length} titles to update out of ${promos.length}\n`);

  if (DRY) {
    console.log("Sample changes (first 10):");
    toChange.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.code}]`);
      console.log(`     BEFORE: ${r.before}`);
      console.log(`     AFTER : ${r.after}\n`);
    });
    console.log("🧪 DRY-RUN complete — no changes written.");
    await db.$disconnect(); return;
  }

  // backup
  console.log("📦 Backing up original titles…");
  for (const chunk of chunker(toChange, 500)) {
    const values = chunk.map(r =>
      `('${r.id.replace(/'/g, "''")}', ${r.before == null ? "NULL" : `'${r.before.replace(/'/g, "''")}'`}, now())`
    ).join(",\n");
    await db.$executeRawUnsafe(`
      INSERT INTO "PromoCodeTitleBackup"(id,title,backed_up_at)
      VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, backed_up_at = now();
    `);
  }

  // apply
  console.log("✍️  Applying scrubbed titles…");
  let updated = 0;
  for (const chunk of chunker(toChange, 200)) {
    await db.$transaction(
      chunk.map(r => db.promoCode.update({
        where: { id: r.id },
        data: { title: r.after, updatedAt: new Date() },
      })),
      { timeout: 60000 }
    );
    updated += chunk.length;
    console.log(`   Updated ${updated}/${toChange.length}`);
  }

  console.log("\n✅ Title scrub complete!");
  console.log('   Backup table: "PromoCodeTitleBackup"');
  console.log('   Rollback SQL: UPDATE "PromoCode" p SET title = b.title FROM "PromoCodeTitleBackup" b WHERE p.id = b.id;');

  await db.$disconnect();
})().catch(async e => { console.error("💥 Scrub failed:", e); try { await db.$disconnect(); } catch { }; process.exit(1); });
