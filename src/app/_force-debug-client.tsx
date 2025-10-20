// src/app/_force-debug-client.tsx
'use client';

if (typeof window !== 'undefined') {
  // Enable by query param for ad-hoc debugging without redeploy:
  const url = new URL(window.location.href);
  if (url.searchParams.get('debugHydration') === '1') {
    (window as any).__DEBUG_HYDRATION = true;
    localStorage.setItem('DEBUG_HYDRATION', '1');
    // eslint-disable-next-line no-console
    console.info('[debug] Hydration debug enabled via query param');
  }
}

export default function ForceDebugClient() {
  return null;
}
