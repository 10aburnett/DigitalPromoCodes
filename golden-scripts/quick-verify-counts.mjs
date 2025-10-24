#!/usr/bin/env node
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), ".env.sync") });

const src = new PrismaClient({ datasources: { db: { url: process.env.SOURCE_DATABASE_URL } } });
const tgt = new PrismaClient({ datasources: { db: { url: process.env.TARGET_DATABASE_URL } } });

console.log("🔍 Verifying sync results (PROD → BACKUP)...\n");

const [srcOT, tgtOT, srcCS, tgtCS] = await Promise.all([
  src.offerTracking.count(),
  tgt.offerTracking.count(),
  src.contactSubmission.count(),
  tgt.contactSubmission.count(),
]);

console.log("📊 OfferTracking:");
console.log(`   SOURCE (PROD):   ${srcOT}`);
console.log(`   TARGET (BACKUP): ${tgtOT}`);
console.log(`   Match: ${srcOT === tgtOT ? "✅" : "❌"}`);
console.log();

console.log("📊 ContactSubmission:");
console.log(`   SOURCE (PROD):   ${srcCS}`);
console.log(`   TARGET (BACKUP): ${tgtCS}`);
console.log(`   Match: ${srcCS === tgtCS ? "✅" : "❌"}`);
console.log();

// Check for duplicates
console.log("🔍 Checking for duplicates...");

const dupOT_src = await src.$queryRaw`
  SELECT COUNT(*) AS count FROM (
    SELECT "promoCodeId", "whopId", "actionType", date_trunc('second',"createdAt")
    FROM "OfferTracking"
    GROUP BY 1,2,3,4
    HAVING COUNT(*) > 1
  ) x;
`;

const dupOT_tgt = await tgt.$queryRaw`
  SELECT COUNT(*) AS count FROM (
    SELECT "promoCodeId", "whopId", "actionType", date_trunc('second',"createdAt")
    FROM "OfferTracking"
    GROUP BY 1,2,3,4
    HAVING COUNT(*) > 1
  ) x;
`;

const dupCS_src = await src.$queryRaw`
  SELECT COUNT(*) AS count FROM (
    SELECT lower(email), date_trunc('minute',"createdAt")
    FROM "ContactSubmission"
    GROUP BY 1,2
    HAVING COUNT(*) > 1
  ) x;
`;

const dupCS_tgt = await tgt.$queryRaw`
  SELECT COUNT(*) AS count FROM (
    SELECT lower(email), date_trunc('minute',"createdAt")
    FROM "ContactSubmission"
    GROUP BY 1,2
    HAVING COUNT(*) > 1
  ) x;
`;

console.log(`   OfferTracking duplicates (PROD):   ${dupOT_src[0].count}`);
console.log(`   OfferTracking duplicates (BACKUP): ${dupOT_tgt[0].count}`);
console.log(`   ContactSubmission duplicates (PROD):   ${dupCS_src[0].count}`);
console.log(`   ContactSubmission duplicates (BACKUP): ${dupCS_tgt[0].count}`);
console.log();

if (dupOT_src[0].count > 0 || dupOT_tgt[0].count > 0 || dupCS_src[0].count > 0 || dupCS_tgt[0].count > 0) {
  console.log("⚠️  WARNING: Duplicates detected!");
} else {
  console.log("✅ No duplicates found!");
}

await src.$disconnect();
await tgt.$disconnect();
