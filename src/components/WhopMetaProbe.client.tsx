'use client';
export default function WhopMetaProbe() {
  if (typeof window !== 'undefined') {
    const el = document.getElementById('dpc-meta-snapshot');
    if (el?.textContent) {
      try {
        const json = JSON.parse(el.textContent);
        console.info('[dpc-meta snapshot]', json);
      } catch {}
    }
  }
  return null;
}
