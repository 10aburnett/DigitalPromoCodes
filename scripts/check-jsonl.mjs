#!/usr/bin/env node
/**
 * Pre-flight validator for JSONL input before starting generation.
 * Checks for required keys, data quality, and basic sanity.
 *
 * Usage:
 *   node scripts/check-jsonl.mjs --in=data/neon/whops.jsonl
 *   npm run content:check
 */

import fs from "fs";

const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const m=a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a,true];
}));

const IN = args.in || "data/neon/whops.jsonl";
const REQUIRED_KEYS = ["slug", "name"]; // strict basics
const URL_KEYS = ["url", "URL", "affiliateLink", "link"]; // accept common aliases

if (!fs.existsSync(IN)) {
  console.error(`❌ Input file not found: ${IN}`);
  console.error("\nExpected file: data/neon/whops.jsonl");
  console.error("\nRun converter first:");
  console.error("   npm run content:convert -- --in=data/neon/whops.json");
  process.exit(1);
}

console.log("🔍 Pre-flight validation...\n");
console.log(`File: ${IN}`);

const content = fs.readFileSync(IN, "utf8");
const lines = content.split(/\r?\n/).filter(Boolean);

if (lines.length === 0) {
  console.error("❌ File is empty");
  process.exit(1);
}

console.log(`Lines: ${lines.length.toLocaleString()}\n`);

// Parse and validate each line
const errors = [];
const warnings = [];
const slugs = new Set();
let duplicates = 0;

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  const line = lines[i].trim();

  // Parse JSON
  let obj;
  try {
    obj = JSON.parse(line);
  } catch (e) {
    errors.push(`Line ${lineNum}: Invalid JSON - ${e.message}`);
    continue;
  }

  // Check required keys
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      errors.push(`Line ${lineNum}: Missing required key '${key}'`);
    }
  }

  // Check for URL (or accepted aliases)
  const hasUrl = URL_KEYS.some(k => obj[k]);
  if (!hasUrl) {
    errors.push(`Line ${lineNum}: Missing url (or alias: ${URL_KEYS.join(", ")})`);
  }

  // Check slug validity
  const slug = obj.slug;
  if (slug) {
    if (typeof slug !== "string") {
      errors.push(`Line ${lineNum}: slug must be string (got ${typeof slug})`);
    } else if (slug.trim() === "") {
      errors.push(`Line ${lineNum}: slug is empty`);
    } else if (slugs.has(slug)) {
      duplicates++;
      warnings.push(`Line ${lineNum}: Duplicate slug '${slug}'`);
    } else {
      slugs.add(slug);
    }
  }

  // Check name validity
  const name = obj.name;
  if (name && typeof name !== "string") {
    warnings.push(`Line ${lineNum}: name should be string (got ${typeof name})`);
  }

  // Stop after 10 errors
  if (errors.length >= 10) {
    errors.push("... (more errors, stopping at 10)");
    break;
  }
}

// Report
console.log("📊 Validation Results:\n");

if (errors.length === 0 && warnings.length === 0) {
  console.log("✅ All checks passed!");
  console.log(`   Unique slugs: ${slugs.size.toLocaleString()}`);
  console.log(`   Total lines:  ${lines.length.toLocaleString()}`);
  console.log("\n✅ Ready for generation!");
  process.exit(0);
}

if (errors.length > 0) {
  console.log(`❌ Errors (${errors.length}):\n`);
  errors.forEach(err => console.log(`   ${err}`));
  console.log("");
}

if (warnings.length > 0) {
  console.log(`⚠️  Warnings (${warnings.length}):\n`);
  // Show first 5 warnings
  warnings.slice(0, 5).forEach(warn => console.log(`   ${warn}`));
  if (warnings.length > 5) {
    console.log(`   ... and ${warnings.length - 5} more`);
  }
  console.log("");
}

// Summary
console.log("📋 Summary:\n");
console.log(`   Valid lines:  ${slugs.size.toLocaleString()}`);
console.log(`   Total lines:  ${lines.length.toLocaleString()}`);
console.log(`   Duplicates:   ${duplicates}`);
console.log(`   Errors:       ${errors.length}`);
console.log(`   Warnings:     ${warnings.length}`);
console.log("");

if (errors.length > 0) {
  console.log("❌ Fix errors before proceeding\n");
  process.exit(1);
}

if (warnings.length > 0) {
  console.log("⚠️  Warnings detected but generation can proceed\n");
  console.log("Consider fixing duplicate slugs if present.\n");
}

console.log("✅ Pre-flight check passed (with warnings)\n");
process.exit(0);
