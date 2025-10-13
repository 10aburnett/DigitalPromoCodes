// src/lib/debug.ts
export const DEBUG_FLAGS = {
  whop: true,          // flip to true/false per area as needed
  reasons: true,
  images: true,
};

export function dlog(area: keyof typeof DEBUG_FLAGS, msg: string, data?: any) {
  if (!DEBUG_FLAGS[area]) return;
  const stamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[DBG:${area}] ${stamp} — ${msg}`, data ?? '');
}
