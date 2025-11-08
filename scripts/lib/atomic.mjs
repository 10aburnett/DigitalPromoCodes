// scripts/lib/atomic.mjs
// Atomic file write helper - prevents partial writes and race conditions
import { writeFile, rename } from 'node:fs/promises';
import crypto from 'node:crypto';

/**
 * Atomically write JSON data to a file (write to temp, then rename)
 * @param {string} path - Target file path
 * @param {object|string} objOrString - Data to write (object will be JSON.stringify'd)
 */
export async function atomicWriteJson(path, objOrString) {
  const tmp = path + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  const data = typeof objOrString === 'string'
    ? objOrString
    : JSON.stringify(objOrString, null, 2);
  await writeFile(tmp, data);
  await rename(tmp, path);
}

/**
 * Atomically write text data to a file (write to temp, then rename)
 * @param {string} path - Target file path
 * @param {string} content - Text content to write
 */
export async function atomicWriteText(path, content) {
  const tmp = path + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, path);
}
