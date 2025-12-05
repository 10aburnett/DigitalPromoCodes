#!/usr/bin/env node
/**
 * JSONL → DB upsert script for successes.jsonl
 * - No CSV layer - reads JSONL directly
 * - Handles multiline HTML content perfectly
 * - Uses Prisma upsert on slug
 */

import fs from "fs";
import readline from "readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

const inputPath = parseArg("in", "data/content/master/successes.jsonl");

if (!fs.existsSync(inputPath)) {
  console.error(`Input JSONL not found: ${inputPath}`);
  process.exit(1);
}

async function main() {
  console.log(`▶ Starting JSONL upsert from: ${inputPath}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for await (const line of rl) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (err) {
      console.error(`JSON parse error on line ${lineNo}:`, err.message);
      errors++;
      continue;
    }

    const slug = obj.slug;
    if (!slug) {
      console.error(`Missing slug on line ${lineNo}, skipping`);
      errors++;
      continue;
    }

    // Map JSONL fields (lowercase) → DB fields (camelCase)
    // faqContent is String column, so JSON.stringify is needed
    const updateData = {
      aboutContent: obj.aboutcontent ?? null,
      howToRedeemContent: obj.howtoredeemcontent ?? null,
      promoDetailsContent: obj.promodetailscontent ?? null,
      termsContent: obj.termscontent ?? null,
      faqContent: obj.faqcontent ? JSON.stringify(obj.faqcontent) : null,
      updatedAt: new Date(),
    };

    try {
      // Check if deal exists first
      const existing = await prisma.deal.findUnique({
        where: { slug },
        select: { id: true }
      });

      if (existing) {
        await prisma.deal.update({
          where: { slug },
          data: updateData,
        });
        updated++;
        if (updated % 100 === 0) {
          console.log(`  … updated ${updated} rows so far`);
        }
      } else {
        notFound++;
      }
    } catch (err) {
      console.error(`Update error at line ${lineNo}, slug=${slug}:`, err.message);
      errors++;
    }
  }

  console.log("\n✅ Done.");
  console.log(`  Updated:   ${updated}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error in upsert script:", err);
  await prisma.$disconnect();
  process.exit(1);
});
