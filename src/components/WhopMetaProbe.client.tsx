'use client';
export default function WhopMetaProbe() {
  if (typeof window !== 'undefined') {
    const el = document.getElementById('whop-meta-snapshot');
    if (el?.textContent) {
      try {
        const json = JSON.parse(el.textContent);
        console.info('[whop-meta snapshot]', json);
      } catch {}
    }
  }
  return null;
}
