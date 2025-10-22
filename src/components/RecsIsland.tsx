'use client';

import { useEffect, useState } from 'react';

type Item = {
  slug: string;
  name: string;
  logo?: string | null;
  description?: string | null;
};

export default function RecsIsland({ items, replaceId }: { items: Item[]; replaceId?: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hide the SSR block so only the client version is visible
    if (replaceId) {
      const el = document.getElementById(replaceId);
      if (el) el.style.display = 'none';
    }
    setReady(true);
  }, [replaceId]);

  if (!ready) return null;

  return (
    <ul className="flex flex-col gap-4">
      {items.map((w, i) => (
        <li key={`${w.slug}#${i}`} className="block rounded-xl border p-4 hover:border-[var(--accent-color)] transition">
          <a
            href={`/whop/${encodeURIComponent(w.slug)}`}
            className="flex gap-3 items-center focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
          >
            <img
              src={w.logo || '/logo.png'}
              alt={w.name}
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              className="w-12 h-12 rounded object-contain bg-[var(--background-secondary)]"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="font-semibold text-base line-clamp-2">{w.name}</div>
              <div className="text-sm text-[var(--text-secondary)] line-clamp-2">{w.description || '\u00A0'}</div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
