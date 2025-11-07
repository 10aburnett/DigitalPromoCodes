#!/usr/bin/env node
/**
 * Fix checkpoint D∩R overlap
 *
 * Problem: Sync script added to done without removing from rejected
 * Solution: Remove any rejected entries that are also in done (success wins)
 */
import fs from "fs";

const CK = "data/content/.checkpoint.json";
const ck = JSON.parse(fs.readFileSync(CK, "utf8"));
ck.done ||= {};
ck.rejected ||= {};

const beforeRej = Object.keys(ck.rejected).length;
let removed = 0;

for (const slug of Object.keys(ck.done)) {
  if (ck.rejected[slug]) {
    delete ck.rejected[slug];
    removed++;
  }
}

const afterRej = Object.keys(ck.rejected).length;

fs.writeFileSync(CK, JSON.stringify(ck, null, 2));

console.log(`✅ Fixed checkpoint overlap!
  Done: ${Object.keys(ck.done).length}
  Rejected: ${beforeRej} → ${afterRej} (-${removed})

Removed ${removed} rejected entries that overlapped with done (success wins).
`);
