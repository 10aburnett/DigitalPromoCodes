import fs from "fs";
import path from "path";

const LOCK_DIR = "/tmp";
const lockFiles = new Map(); // Track which lock file this process owns

function getLockPath(role) {
  return path.join(LOCK_DIR, `.${role}.lock`);
}

export function acquireLock({ role }) {
  const LOCK = getLockPath(role);

  if (fs.existsSync(LOCK)) {
    try {
      const { pid, role: r, t } = JSON.parse(fs.readFileSync(LOCK, "utf8"));
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }

      if (alive) {
        die(`Another ${r || "process"} (PID ${pid}) holds ${role}.lock since ${t}`);
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
  lockFiles.set(role, LOCK);
}

export function releaseLock() {
  // Release all locks held by this process
  for (const [role, lockPath] of lockFiles.entries()) {
    try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch {}
  }
  lockFiles.clear();
}

function die(msg) { console.error(`❌ ${msg}`); process.exit(5); }
