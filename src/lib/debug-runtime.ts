// src/lib/debug-runtime.ts
// Runtime debug switch that works in browser without rebuild

export const debugOn =
  (typeof window !== 'undefined' && (window as any).__DEBUG_HYDRATION === true) ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_HYDRATION') === '1') ||
  process.env.NEXT_PUBLIC_HYDRATION_DEBUG === '1';
