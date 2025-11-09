// scripts/lib/withFileLock.mjs
// File-based exclusive lock helper with stale-lock detection
import fs from "fs/promises";
import { readFileSync, rmSync } from "fs";
import process from "process";
import path from "path";

const LOCK_DIR = "data/locks";
await fs.mkdir(LOCK_DIR, { recursive: true });

/**
 * Execute a function with an exclusive file lock
 * Automatically detects and cleans stale locks (>10min or dead PID)
 * @param {string} lockName - Name of the lock (e.g., "build-next-batch")
 * @param {Function} fn - Async function to execute while holding the lock
 * @returns {Promise<any>} Result of fn()
 */
export async function withFileLock(lockName, fn) {
  // Accept any input (basename, full path, with/without .lock)
  const base = path.basename(String(lockName)).replace(/\.lock$/i, "");
  const lockPath = path.join(LOCK_DIR, `${base}.lock`);
  const now = Date.now();

  // Try to acquire
  try {
    const fh = await fs.open(lockPath, "wx"); // exclusive create
    await fh.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    await fh.close();
  } catch (e) {
    // If exists, check staleness
    if (e.code === "EEXIST") {
      try {
        const meta = JSON.parse(readFileSync(lockPath, "utf8"));
        const ageMs = now - new Date(meta.at).getTime();
        const STALE_MS = 10 * 60 * 1000; // 10 minutes

        // is owner alive?
        const ownerAlive = (() => {
          try { return process.kill(meta.pid, 0), true; } catch { return false; }
        })();

        if (!ownerAlive || ageMs > STALE_MS) {
          // stale: remove and re-acquire
          console.warn(`🔓 Removing stale lock: ${lockName} (age=${Math.round(ageMs/1000)}s, ownerAlive=${ownerAlive})`);
          rmSync(lockPath, { force: true });
          const fh2 = await fs.open(lockPath, "wx");
          await fh2.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
          await fh2.close();
        } else {
          throw e; // legit contention
        }
      } catch (parseErr) {
        // If we can't parse, treat as stale
        console.warn(`🔓 Removing unparseable lock: ${lockName}`);
        rmSync(lockPath, { force: true });
        const fh2 = await fs.open(lockPath, "wx");
        await fh2.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
        await fh2.close();
      }
    } else {
      throw e;
    }
  }

  try {
    return await fn();
  } finally {
    try { await fs.unlink(lockPath); } catch {}
  }
}
