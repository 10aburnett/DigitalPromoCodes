#!/usr/bin/env node
/**
 * 🏆 GOLDEN SAFE OFFERTRACKING APPEND (with FK mapping) — NO DELETIONS EVER
 * Natural key: (promoCodeId_tgt, whopId_tgt, actionType, createdAt_truncated_to_second)
 *
 * Usage:
 *   # Set direction in .env.sync or env vars
 *   node golden-scripts/GOLDEN-SAFE-OFFERTRACKING-APPEND.mjs --dry
 *   node golden-scripts/GOLDEN-SAFE-OFFERTRACKING-APPEND.mjs
 */

import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

config({ path: path.resolve(process.cwd(), ".env.sync") });

const DRY = process.argv.includes("--dry") || process.argv.includes("-n");

// IMPORTANT: For OfferTracking you likely want PROD → BACKUP right now.
// Either swap SOURCE/TARGET in .env.sync or override via env before running.
const SRC_URL = process.env.SOURCE_DATABASE_URL;
const TGT_URL = process.env.TARGET_DATABASE_URL;

if (!SRC_URL || !TGT_URL) {
  console.error("❌ Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL");
  process.exit(1);
}

const src = new PrismaClient({ datasources: { db: { url: SRC_URL } } });
const tgt = new PrismaClient({ datasources: { db: { url: TGT_URL } } });

const secondKey = (createdAt) => {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  // Truncate to second
  d.setMilliseconds(0);
  return d.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
};

(async () => {
  console.log("🚀 GOLDEN SAFE OFFERTRACKING APPEND (FK-mapped)");
  console.log(`Mode: ${DRY ? "🧪 DRY-RUN" : "✅ LIVE"}`);
  console.log(`Source: ${SRC_URL.substring(0, 60)}...`);
  console.log(`Target: ${TGT_URL.substring(0, 60)}...`);
  console.log();

  // 1) Pull minimal data from SOURCE
  console.log("📊 Fetching SOURCE OfferTracking + joins for mapping...");
  const [srcOT, srcPromos, srcWhops] = await Promise.all([
    src.offerTracking.findMany({
      select: {
        promoCodeId: true,
        whopId: true,
        actionType: true,
        createdAt: true,
        path: true,
      },
    }),
    src.promoCode.findMany({
      select: { id: true, code: true, whopId: true },
    }),
    src.whop.findMany({
      select: { id: true, slug: true },
    }),
  ]);
  console.log(`   SOURCE OfferTracking: ${srcOT.length}`);
  console.log();

  // 2) Build SOURCE maps: promoId -> { code, whopSlug }, whopId -> slug
  const srcWhopIdToSlug = new Map(srcWhops.map((w) => [w.id, w.slug]));
  const srcPromoIdToCodeSlug = new Map(
    srcPromos.map((p) => [p.id, { code: p.code, whopSlug: srcWhopIdToSlug.get(p.whopId) }]),
  );

  // 3) Load TARGET lookup tables: slug -> whopId, (whopId, code) -> promoId
  console.log("🔍 Resolving TARGET FK mappings (slug & code)...");
  const tgtWhops = await tgt.whop.findMany({ select: { id: true, slug: true } });
  const slugToTgtWhopId = new Map(tgtWhops.map((w) => [w.slug, w.id]));

  const tgtPromos = await tgt.promoCode.findMany({ select: { id: true, code: true, whopId: true } });
  const promoKey = (whopId, code) => `${whopId}::${code}`.toLowerCase();
  const tgtPromoMap = new Map(tgtPromos.map((p) => [promoKey(p.whopId, p.code), p.id]));

  // 4) Transform SOURCE OfferTracking rows -> TARGET FK ids (filter out those we cannot map)
  const transformed = [];
  let unmappedWhop = 0;
  let unmappedPromo = 0;

  for (const r of srcOT) {
    // from source promoCodeId -> {code, whopSlug}
    const meta = srcPromoIdToCodeSlug.get(r.promoCodeId);
    if (!meta || !meta.whopSlug) {
      unmappedPromo++;
      continue;
    }
    const tgtWhopId = slugToTgtWhopId.get(meta.whopSlug);
    if (!tgtWhopId) {
      unmappedWhop++;
      continue;
    }
    const tgtPromoId = tgtPromoMap.get(promoKey(tgtWhopId, meta.code));
    if (!tgtPromoId) {
      // promo doesn't exist on target (should be rare if promos are already synced)
      unmappedPromo++;
      continue;
    }

    transformed.push({
      promoCodeId: tgtPromoId,
      whopId: tgtWhopId,
      actionType: r.actionType,
      createdAt: r.createdAt,
      path: r.path,
    });
  }

  console.log(`   Mappable rows: ${transformed.length}`);
  console.log(`   Unmapped (whop slug missing on target): ${unmappedWhop}`);
  console.log(`   Unmapped (promo code missing on target): ${unmappedPromo}`);
  console.log();

  // 5) Compute what the TARGET already has (by natural key) and diff
  console.log("📦 Loading TARGET OfferTracking keys for diff...");
  const tgtExisting = await tgt.offerTracking.findMany({
    select: { promoCodeId: true, whopId: true, actionType: true, createdAt: true },
  });
  const existingKey = new Set(
    tgtExisting.map(
      (x) => `${x.promoCodeId}::${x.whopId}::${x.actionType}::${secondKey(x.createdAt)}`
    )
  );

  const missing = transformed.filter(
    (x) => !existingKey.has(`${x.promoCodeId}::${x.whopId}::${x.actionType}::${secondKey(x.createdAt)}`)
  );

  console.log(`   Missing from TARGET (by natural key): ${missing.length}`);
  console.log();

  if (missing.length === 0) {
    console.log("✅ Target is up to date. Nothing to insert.");
    await src.$disconnect(); await tgt.$disconnect();
    console.log(DRY ? "🧪 DRY-RUN COMPLETE" : "🎉 SYNC COMPLETED SUCCESSFULLY!");
    return;
  }

  if (DRY) {
    console.log(`🧪 DRY-RUN: Would insert ${missing.length} rows`);
    console.log("   Sample (first 5):");
    missing.slice(0, 5).forEach((m, i) =>
      console.log(`   ${i + 1}. ${m.actionType} | promoId=${m.promoCodeId} whopId=${m.whopId} | ${m.createdAt}`)
    );
    await src.$disconnect(); await tgt.$disconnect();
    console.log("🧪 DRY-RUN COMPLETE");
    return;
  }

  console.log("✍️  Inserting in batches with skipDuplicates=true…");
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const batch = missing.slice(i, i + CHUNK);
    await tgt.offerTracking.createMany({
      data: batch.map(r => ({
        id: `ot_${randomUUID()}`,
        promoCodeId: r.promoCodeId,
        whopId: r.whopId,
        actionType: r.actionType,
        createdAt: r.createdAt,
        path: r.path ?? null,
      })),
      skipDuplicates: true, // ok to keep; app-side diffing already prevents dups
    });
    inserted += batch.length;
    console.log(`   Inserted ${Math.min(inserted, missing.length)}/${missing.length}`);
  }

  await src.$disconnect(); await tgt.$disconnect();
  console.log("🎉 SYNC COMPLETED SUCCESSFULLY!");
})().catch(async (err) => {
  console.error("\n💥 SYNC FAILED:", err);
  try { await src.$disconnect(); } catch {}
  try { await tgt.$disconnect(); } catch {}
  process.exit(1);
});
