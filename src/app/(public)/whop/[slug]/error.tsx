'use client';

export default function WhopRouteError({ error, reset }: { error: any; reset: () => void }) {
  // This renders server errors instead of a permanent skeleton.
  return (
    <div style={{ padding: 16, background: '#2b1a1a', color: '#ffd2d2', borderRadius: 8 }}>
      <strong>Whop page crashed:</strong>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{String(error?.message || error)}</pre>
      <button onClick={reset} style={{ marginTop: 8, padding: '6px 10px' }}>Retry</button>
    </div>
  );
}
