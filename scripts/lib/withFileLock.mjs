// scripts/lib/withFileLock.mjs
// File-based exclusive lock helper with stale-lock detection
import fs from 'fs/promises';
import path from 'path';

/**
 * Execute a function with an exclusive file lock
 * Automatically detects and cleans stale locks (>120s)
 * @param {string} lockName - Name of the lock (e.g., "build-next-batch")
 * @param {Function} fn - Async function to execute while holding the lock
 * @returns {Promise<any>} Result of fn()
 */
export default async function withFileLock(lockName, fn) {
  const lockDir = path.resolve('data/locks');
  await fs.mkdir(lockDir, { recursive: true });

  // Always pass just a NAME like "build-next-batch"
  const lockFile = path.join(lockDir, `${lockName}.lock`);

  let handle;
  try {
    // fail if exists
    handle = await fs.open(lockFile, 'wx');
  } catch (e) {
    if (e?.code === 'EEXIST') {
      // treat as stale if older than 120s
      try {
        const st = await fs.stat(lockFile);
        const ageSec = (Date.now() - st.mtimeMs) / 1000;
        if (ageSec > 120) {
          await fs.rm(lockFile, { force: true });
          handle = await fs.open(lockFile, 'wx');
        } else {
          throw new Error(`Lock already held: ${lockFile} (age=${ageSec.toFixed(0)}s)`);
        }
      } catch (statErr) {
        throw new Error(`Lock exists and not removable: ${lockFile}`);
      }
    } else {
      throw e;
    }
  }

  try {
    return await fn();
  } finally {
    try { await handle?.close(); } catch {}
    try { await fs.rm(lockFile, { force: true }); } catch {}
  }
}
