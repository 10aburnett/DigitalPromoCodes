#!/usr/bin/env node
/**
 * 🏆 GOLDEN SAFE CONTACTSUBMISSION APPEND — NO DELETIONS EVER
 * Natural key: (lower(email), date_trunc('minute', createdAt))
 *
 * Usage:
 *   # Set direction in .env.sync or env vars
 *   node golden-scripts/GOLDEN-SAFE-CONTACTSUBMISSION-APPEND.mjs --dry
 *   node golden-scripts/GOLDEN-SAFE-CONTACTSUBMISSION-APPEND.mjs
 */

import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

config({ path: path.resolve(process.cwd(), ".env.sync") });

const DRY = process.argv.includes("--dry") || process.argv.includes("-n");

const SRC_URL = process.env.SOURCE_DATABASE_URL;
const TGT_URL = process.env.TARGET_DATABASE_URL;

if (!SRC_URL || !TGT_URL) {
  console.error("❌ Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL");
  process.exit(1);
}

const src = new PrismaClient({ datasources: { db: { url: SRC_URL } } });
const tgt = new PrismaClient({ datasources: { db: { url: TGT_URL } } });

// Natural key: (lower(email), date_trunc('minute', createdAt))
const KEY = (r) => {
  const email = (r.email || "").toLowerCase();
  const d = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
  // Truncate to minute
  d.setSeconds(0, 0);
  const minute = d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  return `${email}::${minute}`;
};

(async () => {
  console.log("🚀 GOLDEN SAFE CONTACTSUBMISSION APPEND");
  console.log(`Mode: ${DRY ? "🧪 DRY-RUN" : "✅ LIVE"}`);
  console.log(`Source: ${SRC_URL.substring(0, 60)}...`);
  console.log(`Target: ${TGT_URL.substring(0, 60)}...`);
  console.log();

  console.log("📊 Fetching ContactSubmission records...");
  const [srcData, tgtData] = await Promise.all([
    src.contactSubmission.findMany({
      select: {
        name: true,
        email: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    tgt.contactSubmission.findMany({
      select: {
        email: true,
        createdAt: true,
      },
    }),
  ]);

  console.log(`   Source: ${srcData.length} submissions`);
  console.log(`   Target: ${tgtData.length} submissions`);

  const have = new Set(tgtData.map(KEY));
  const missing = srcData.filter((r) => !have.has(KEY(r)));

  console.log(`   Missing from target: ${missing.length} submissions`);
  console.log();

  if (missing.length === 0) {
    console.log("✅ Target is up to date. Nothing to insert.");
    await src.$disconnect();
    await tgt.$disconnect();
    console.log(DRY ? "🧪 DRY-RUN COMPLETE" : "🎉 SYNC COMPLETED SUCCESSFULLY!");
    return;
  }

  if (DRY) {
    console.log(`🧪 DRY-RUN: Would insert ${missing.length} rows`);
    console.log("   Sample (first 5):");
    missing.slice(0, 5).forEach((m, i) =>
      console.log(`   ${i + 1}. ${m.email} | ${m.subject} | ${m.createdAt}`)
    );
    await src.$disconnect();
    await tgt.$disconnect();
    console.log("🧪 DRY-RUN COMPLETE");
    return;
  }

  console.log("✍️  Inserting in batches with skipDuplicates=true…");
  const CHUNK = 200;
  let inserted = 0;

  for (let i = 0; i < missing.length; i += CHUNK) {
    const batch = missing.slice(i, i + CHUNK);
    await tgt.contactSubmission.createMany({
      data: batch.map((r) => ({
        id: `cs_${randomUUID()}`,
        name: r.name,
        email: r.email,
        subject: r.subject,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      skipDuplicates: true, // relies on unique index
    });
    inserted += batch.length;
    console.log(`   Inserted ${Math.min(inserted, missing.length)}/${missing.length}`);
  }

  await src.$disconnect();
  await tgt.$disconnect();
  console.log("🎉 SYNC COMPLETED SUCCESSFULLY!");
})().catch(async (err) => {
  console.error("\n💥 SYNC FAILED:", err);
  try {
    await src.$disconnect();
  } catch {}
  try {
    await tgt.$disconnect();
  } catch {}
  process.exit(1);
});
