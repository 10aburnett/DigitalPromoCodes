// scripts/lib/withFileLock.mjs
// File-based exclusive lock helper for atomic batch construction
import { open, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Execute a function with an exclusive file lock
 * @param {string} lockPath - Path to the lock file
 * @param {Function} fn - Async function to execute while holding the lock
 * @param {Object} options - Options
 * @param {number} options.ttlMs - Time-to-live in ms (auto-release after timeout)
 * @returns {Promise<any>} Result of fn()
 */
export async function withFileLock(lockPath, fn, { ttlMs = 120000 } = {}) {
  // Ensure lock directory exists
  const lockDir = path.dirname(lockPath);
  await mkdir(lockDir, { recursive: true });

  let fd;
  try {
    // Best-effort lock via O_EXCL semantics - throws if exists
    fd = await open(lockPath, 'wx');
    await writeFile(fd, String(Date.now()));

    // Auto-cleanup stale lock after TTL
    const timer = setTimeout(async () => {
      try { await rm(lockPath); } catch {}
    }, ttlMs);

    try {
      return await fn();
    } finally {
      clearTimeout(timer);
    }
  } finally {
    try { if (fd) await fd.close(); } catch {}
    try { await rm(lockPath); } catch {}
  }
}
