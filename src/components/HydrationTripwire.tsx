'use client';

import { useEffect } from 'react';
import { djb2 } from '@/lib/hydration-debug';
import { debugOn } from '@/lib/debug-runtime';

function safeParse(el: Element | null) {
  try {
    if (!el) return null;
    const txt = el.textContent || '';
    return JSON.parse(txt);
  } catch { return null; }
}

export default function HydrationTripwire({
  targetId = 'whop-meta',
  snapshotId = 'whop-meta-snapshot',
}: { targetId?: string; snapshotId?: string }) {
  useEffect(() => {
    // Only activate if debug is enabled
    if (!debugOn) {
      console.info('[HydrationTripwire] Not active. Enable with ?debugHydration=1 or set localStorage.DEBUG_HYDRATION=1');
      return;
    }

    console.info('[HydrationTripwire] Active - monitoring for hydration errors');

    const handler = (event: any) => {
      const msg = String(event?.message || event);
      if (!/React error #418|React error #423|hydration/i.test(msg)) return;

      const host = document.getElementById(targetId);
      const script = document.getElementById(snapshotId);
      const serverHash = host?.getAttribute('data-hash') || 'n/a';
      const snap = safeParse(script);
      const snapHash = snap ? djb2(JSON.stringify(snap)) : 'n/a';

      console.group('[HydrationTripwire] 🚨 HYDRATION ERROR DETECTED');
      console.error('Error message:', msg);
      console.log('serverHash (data-hash):', serverHash);
      console.log('snapshotHash (computed):', snapHash);
      console.log('Match:', serverHash === snapHash ? '✅ SAME' : '❌ DIFFERENT');
      console.log('serverSnapshot (first 1k chars):', JSON.stringify(snap)?.slice(0, 1000));
      console.log('outerHTML (first 2k chars):', host?.outerHTML?.slice(0, 2000));
      console.groupEnd();
    };

    window.addEventListener('error', handler);
    // react 18 queuing sometimes goes to console.error directly; monkey-patch lightly
    const orig = console.error;
    (console as any).error = function (...args: any[]) {
      try {
        if (args.some(a => typeof a === 'string' && /React error #418|React error #423|hydration/i.test(a))) {
          handler({ message: args.join(' ') });
        }
      } catch {}
      return (orig as any).apply(this, args);
    };
    return () => {
      window.removeEventListener('error', handler);
      console.error = orig;
    };
  }, [targetId, snapshotId]);

  return null;
}
