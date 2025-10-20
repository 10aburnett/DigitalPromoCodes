// src/lib/notFoundReason.tsx
import { notFound } from 'next/navigation';
import { dlog } from './debug';

export function notFoundWithReason(reason: string, ctx?: any) {
  dlog('reasons', `notFound() — ${reason}`, ctx);
  notFound();
}

/** Render a debug banner at the top of the page when ?__debug=1 */
export function DebugBanner({ reason, ctx }: { reason?: string; ctx?: any }) {
  if (!reason) return null;
  if (process.env.NODE_ENV !== 'development') return null;
  if (typeof window === 'undefined') return null;
  const show = new URLSearchParams(window.location.search).get('__debug') === '1';
  if (!show) return null;
  return (
    <pre style={{ background: '#111', color: '#9ef', padding: 12, border: '1px solid #345' }}>
      <strong>DEBUG REASON:</strong> {reason}
      {'\n'}
      {ctx ? JSON.stringify(ctx, null, 2) : null}
    </pre>
  );
}
