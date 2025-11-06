#!/usr/bin/env node
// scripts/test-sets.mjs
//
// Quick unit tests for scripts/lib/sets.mjs
// Validates slug hygiene predicates and file loading determinism

import { isValidSlug, toSet, writeFileAtomic } from "./lib/sets.mjs";
import fs from "fs";
import assert from "assert";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

console.log("🧪 Running unit tests for scripts/lib/sets.mjs\n");

// === Test isValidSlug() ===
test("isValidSlug: rejects empty string", () => {
  assert.strictEqual(isValidSlug(""), false);
});

test("isValidSlug: rejects just hyphen", () => {
  assert.strictEqual(isValidSlug("-"), false);
});

test("isValidSlug: rejects whitespace", () => {
  assert.strictEqual(isValidSlug("foo bar"), false);
  assert.strictEqual(isValidSlug("foo\tbar"), false);
  assert.strictEqual(isValidSlug("foo\nbar"), false);
  assert.strictEqual(isValidSlug(" "), false);
});

test("isValidSlug: accepts normal slugs", () => {
  assert.strictEqual(isValidSlug("foo"), true);
  assert.strictEqual(isValidSlug("foo-bar"), true);
  assert.strictEqual(isValidSlug("foo-bar-baz"), true);
  assert.strictEqual(isValidSlug("abc123"), true);
  assert.strictEqual(isValidSlug("123abc"), true);
});

test("isValidSlug: accepts leading hyphen (by design)", () => {
  assert.strictEqual(isValidSlug("-foo"), true);
  assert.strictEqual(isValidSlug("-1-month-pass"), true);
});

test("isValidSlug: rejects trailing hyphen followed by space", () => {
  assert.strictEqual(isValidSlug("foo- "), false);
});

test("isValidSlug: accepts trailing hyphen", () => {
  assert.strictEqual(isValidSlug("foo-"), true);
});

// === Test toSet() ===
test("toSet: converts array to Set", () => {
  const s = toSet(["a", "b", "c"]);
  assert.strictEqual(s.size, 3);
  assert.strictEqual(s.has("a"), true);
  assert.strictEqual(s.has("b"), true);
  assert.strictEqual(s.has("c"), true);
});

test("toSet: deduplicates items", () => {
  const s = toSet(["a", "a", "b"]);
  assert.strictEqual(s.size, 2);
  assert.strictEqual(s.has("a"), true);
  assert.strictEqual(s.has("b"), true);
});

test("toSet: handles empty array", () => {
  const s = toSet([]);
  assert.strictEqual(s.size, 0);
});

// === Test writeFileAtomic() ===
test("writeFileAtomic: creates file with correct content", () => {
  const testPath = "/tmp/test-atomic-write.txt";
  const content = "test content\nline 2";

  // Clean up before test
  try { fs.unlinkSync(testPath); } catch {}
  try { fs.unlinkSync(`${testPath}.tmp`); } catch {}

  writeFileAtomic(testPath, content);

  const read = fs.readFileSync(testPath, "utf8");
  assert.strictEqual(read, content);

  // Verify no temp file left behind
  assert.strictEqual(fs.existsSync(`${testPath}.tmp`), false);

  // Clean up after test
  fs.unlinkSync(testPath);
});

test("writeFileAtomic: overwrites existing file", () => {
  const testPath = "/tmp/test-atomic-overwrite.txt";

  // Clean up before test
  try { fs.unlinkSync(testPath); } catch {}

  writeFileAtomic(testPath, "old content");
  writeFileAtomic(testPath, "new content");

  const read = fs.readFileSync(testPath, "utf8");
  assert.strictEqual(read, "new content");

  // Clean up after test
  fs.unlinkSync(testPath);
});

// === Summary ===
console.log(`\n${"=".repeat(50)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} tests passed!`);
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
  process.exit(1);
}
