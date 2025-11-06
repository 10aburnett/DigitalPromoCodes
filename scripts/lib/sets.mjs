// scripts/lib/sets.mjs
import fs from "fs";

export const NEEDS_FILE = "/tmp/needs-content.csv";
export const PROMO_FILE = "data/promo-whop-slugs.txt";
export const CHECKPOINT_FILE = "data/content/.checkpoint.json";
export const MANUAL_FILE = "data/manual/promo-manual-content.txt";
export const DENY_FILE = "data/manual/denylist.txt";

function readLinesStrict(p) {
  try {
    // Normalize: trim, drop empties, drop duplicates implicitly via Set
    return fs.readFileSync(p, "utf8")
      .split(/\r?\n|,/g)              // accept CSV or TXT (we use TXT, but be defensive)
      .map(s => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function loadCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"));
  } catch {
    return { done: {}, rejected: {}, deferred: {} };
  }
}

export function toSet(iterable) {
  const s = new Set();
  for (const x of iterable) s.add(x);
  return s;
}

export function loadState() {
  const needs = toSet(readLinesStrict(NEEDS_FILE));
  const promo = toSet(readLinesStrict(PROMO_FILE));
  const manual = toSet(readLinesStrict(MANUAL_FILE));
  const deny = toSet(readLinesStrict(DENY_FILE));
  const ck = loadCheckpoint();
  const done = toSet(Object.keys(ck.done || {}));
  const rejected = toSet(Object.keys(ck.rejected || {}));
  return { needs, promo, manual, deny, done, rejected };
}

/** Hygiene predicate used everywhere (builder + preflight). */
export function isValidSlug(slug) {
  // 1) No whitespace, not just "-"
  if (!slug || slug === "-" || /\s/.test(slug)) return false;
  // 2) Allowed: letters, digits, hyphens; may start with hyphen
  // If you want to forbid leading hyphen globally, do it here once.
  return /^-?[a-z0-9][a-z0-9-]*$/i.test(slug);
}

/** Atomic write: write to temp file, then rename. Prevents half-written files. */
export function writeFileAtomic(path, content) {
  const tmpPath = `${path}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, path);
}
