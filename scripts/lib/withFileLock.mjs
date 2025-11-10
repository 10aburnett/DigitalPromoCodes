// scripts/lib/withFileLock.mjs
import fs from "fs";
import path from "path";

function alive(pid) {
  try { if (!pid) return false; process.kill(+pid, 0); return true; } catch { return false; }
}

export default async function withFileLock(name, fn, { maxAgeSec = 120 } = {}) {
  const dir = path.resolve("data/locks");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.lock`);

  const writeLock = (meta={}) => {
    const fh = fs.openSync(file, "wx");
    fs.writeFileSync(fh, JSON.stringify({ pid: process.pid, ts: Date.now(), ...meta }));
    fs.closeSync(fh);
  };

  try { writeLock(); }
  catch (e) {
    if (e.code !== "EEXIST") throw e;

    // Inspect existing lock
    let pid=null, age=Infinity;
    try {
      const raw = fs.readFileSync(file, "utf8");
      const stat = fs.statSync(file);
      age = (Date.now() - stat.mtimeMs)/1000;
      pid = JSON.parse(raw)?.pid ?? null;
    } catch {}

    const stale = !alive(pid) || age > maxAgeSec;

    if (!stale) throw new Error(`Lock held: ${file} by pid=${pid ?? "?"}`);

    // Replace stale lock
    try { fs.unlinkSync(file); } catch {}
    writeLock({ replacedStale: true });
  }

  try { return await fn(); }
  finally { try { fs.unlinkSync(file); } catch {} }
}
