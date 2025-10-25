#!/usr/bin/env node
/**
 * 🏆 GOLDEN DEDUPE PROMO CODES (case-insensitive, per whop)
 * - Canonical per group: prefer row whose code === lower(code); fallback to the one with most OfferTracking
 * - Repoints FKs (OfferTracking, PromoCodeSubmission) then deletes redundant rows
 * - Adds unique index on ("whopId", lower(code)) to prevent regressions
 *
 * Usage:
 *   node golden-scripts/GOLDEN-DEDUPE-PROMOCODES-CASEFOLD.mjs --dry
 *   DATABASE_URL=... node golden-scripts/GOLDEN-DEDUPE-PROMOCODES-CASEFOLD.mjs
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), ".env.sync") });

const DRY = process.argv.includes("--dry") || process.argv.includes("-n");
const DB_URL = process.env.DATABASE_URL || process.env.SOURCE_DATABASE_URL || process.env.TARGET_DATABASE_URL;
if (!DB_URL) {
  console.error("❌ No DATABASE_URL/SOURCE_DATABASE_URL/TARGET_DATABASE_URL set.");
  process.exit(1);
}

const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });

function* chunk(arr, size) { for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size); }

(async () => {
  console.log(`🔎 Case-insensitive promo-code dedupe (${DRY ? "DRY-RUN" : "LIVE"})`);
  // minimal backup tables
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromoCodeDedupeBackup"(
      id text PRIMARY KEY,
      whop_id text,
      code text,
      title text,
      description text,
      value text,
      created_at timestamptz,
      updated_at timestamptz,
      backed_up_at timestamptz default now()
    );
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PromoCodeDedupeMap"(
      duplicate_id text PRIMARY KEY,
      keep_id text NOT NULL,
      whop_id text NOT NULL,
      code_lower text NOT NULL,
      mapped_at timestamptz default now()
    );
  `);

  // Load promos + OT counts for picking canonical
  const promos = await db.promoCode.findMany({
    select: { id: true, whopId: true, code: true, title: true, description: true, value: true, createdAt: true, updatedAt: true }
  });

  const otCountsArr = await db.offerTracking.groupBy({
    by: ["promoCodeId"],
    _count: { promoCodeId: true }
  }).catch(() => []);
  const otCount = new Map(otCountsArr.map(r => [r.promoCodeId, r._count.promoCodeId]));

  // Group by (whopId, lower(code))
  const groups = new Map(); // key => Promo[]
  for (const p of promos) {
    const key = `${p.whopId}::${(p.code || "").toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const collisions = [...groups.entries()]
    .map(([key, list]) => ({ key, list }))
    .filter(g => g.list.length > 1);

  if (collisions.length === 0) {
    console.log("✅ No case-insensitive duplicates found.");
    await db.$disconnect();
    return;
  }

  // Build actions
  const actions = [];
  for (const { key, list } of collisions) {
    const [whopId, codeLower] = key.split("::");
    // choose keep: prioritize data preservation (most OfferTracking)
    // 1) choose the one with most OfferTracking data
    const keep = list.slice().sort((a,b) => (otCount.get(b.id)||0) - (otCount.get(a.id)||0))[0] || list[0];
    // 2) we'll normalize it to lowercase later (it will be done in the update step)

    const dups = list.filter(p => p.id !== keep.id);
    actions.push({ whopId, codeLower, keep, dups });
  }

  // DRY preview
  console.log(`⚠️  Found ${actions.length} duplicate groups (${actions.reduce((n,a)=>n+a.dups.length,0)} rows to merge)`);
  if (DRY) {
    actions.slice(0, 10).forEach((a, i) => {
      console.log(`\n#${i+1} whop=${a.whopId} codeLower=${a.codeLower}`);
      console.log(`  keep: ${a.keep.id} | code=${a.keep.code} | OT=${otCount.get(a.keep.id)||0}`);
      a.dups.forEach(d => console.log(`  drop: ${d.id} | code=${d.code} | OT=${otCount.get(d.id)||0}`));
    });
    console.log("\n🧪 DRY-RUN complete — no changes written.");
    await db.$disconnect();
    return;
  }

  // Check if PromoCodeSubmission table exists
  const hasPromoSubmissionTable = await db.$queryRaw`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'PromoCodeSubmission'
    );
  `.then(r => r[0]?.exists ?? false).catch(() => false);

  // Live: backup & merge one group per transaction to avoid batch aborts
  let merged = 0;
  for (const a of actions) {
    try {
      await db.$transaction(async (tx) => {
        // 1) backup duplicate rows
        for (const d of a.dups) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "PromoCodeDedupeBackup"(id, whop_id, code, title, description, value, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (id) DO NOTHING;
          `, d.id, d.whopId, d.code, d.title, d.description, d.value, d.createdAt, d.updatedAt);
        }

        // 2) rewire FKs
        const keepId = a.keep.id;
        const dupIds = a.dups.map(d => d.id);
        if (dupIds.length === 0) return;

        await tx.$executeRawUnsafe(`
          UPDATE "OfferTracking"
             SET "promoCodeId" = $1
           WHERE "promoCodeId" = ANY($2::text[]);
        `, keepId, dupIds);

        if (hasPromoSubmissionTable) {
          await tx.$executeRawUnsafe(`
            UPDATE "PromoCodeSubmission"
               SET "promoCodeId" = $1
             WHERE "promoCodeId" = ANY($2::text[]);
          `, keepId, dupIds);
        }

        // 3) audit map
        for (const d of a.dups) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "PromoCodeDedupeMap"(duplicate_id, keep_id, whop_id, code_lower)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (duplicate_id) DO NOTHING;
          `, d.id, keepId, a.whopId, a.codeLower);
        }

        // 4) delete dupes
        await tx.$executeRawUnsafe(`
          DELETE FROM "PromoCode" WHERE id = ANY($1::text[]);
        `, dupIds);

        // 5) normalize kept code to lowercase
        await tx.$executeRawUnsafe(`
          UPDATE "PromoCode" SET code = lower(code), "updatedAt" = now() WHERE id = $1;
        `, keepId);
      }, { timeout: 120000 });
      merged++;
      console.log(`   [${merged}/${actions.length}] Merged whop=${a.whopId} codeLower=${a.codeLower} (kept ${a.keep.id})`);
    } catch (err) {
      console.error(`💥 Failed group whop=${a.whopId} codeLower=${a.codeLower} (keep=${a.keep.id})`, err.message);
      // continue to next group
    }
  }

  // Add guardrail unique index
  console.log("🧱 Ensuring unique index on (whopId, lower(code))…");
  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='promo_whop_codelower_uniq'
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX promo_whop_codelower_uniq ON "PromoCode"("whopId", lower(code))';
      END IF;
    END$$;
  `);

  console.log("✅ Dedupe complete.");
  await db.$disconnect();
})().catch(async (e) => {
  console.error("💥 Dedupe failed:", e);
  try { await db.$disconnect(); } catch {}
  process.exit(1);
});
