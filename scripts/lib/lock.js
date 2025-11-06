import fs from "fs";
const LOCK = "run.lock";

export function acquireLock({ role }) {
  if (fs.existsSync(LOCK)) {
    try {
      const { pid, role: r, t } = JSON.parse(fs.readFileSync(LOCK, "utf8"));
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }

      if (alive) {
        die(`Another ${r || "process"} (PID ${pid}) holds ${LOCK} since ${t}`);
      } else {
        // stale
        fs.unlinkSync(LOCK);
      }
    } catch {
      // unreadable → assume stale
      fs.unlinkSync(LOCK);
    }
  }
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, role, t: new Date().toISOString() }));
}

export function releaseLock() {
  try { if (fs.existsSync(LOCK)) fs.unlinkSync(LOCK); } catch {}
}

function die(msg) { console.error(`❌ ${msg}`); process.exit(5); }
