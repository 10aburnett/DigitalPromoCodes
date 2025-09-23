'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/base-url';
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';

type AltLink = { slug: string; anchorText: string };

export default function Alternatives({ currentWhopSlug }: { currentWhopSlug: string }) {
  const [links, setLinks] = useState<AltLink[]>([]);
  const [desc, setDesc] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  // simple fallback title from slug
  const pretty = (s: string) =>
    s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLinks([]);
        setDesc('');

        const base = getBaseUrl();
        const useGraph =
          process.env.NEXT_PUBLIC_USE_GRAPH_LINKS === 'true' ||
          process.env.USE_GRAPH_LINKS === 'true';

        // Try deterministic neighbors.json first
        if (useGraph) {
          try {
            const neighbors = await loadNeighbors();
            const slugs = getNeighborSlugsFor(neighbors, currentWhopSlug, 'alternatives').slice(0, 6);

            if (slugs.length) {
              // call API once to harvest editorialDescription + anchorText for these slugs
              try {
                const res = await fetch(
                  `${base}/api/whops/${encodeURIComponent(currentWhopSlug)}/alternatives`,
                  { cache: 'no-store' }
                );
                const data = res.ok ? await res.json() : { alternatives: [], editorialDescription: '' };

                const anchorBySlug = new Map<string, string>();
                for (const a of data?.alternatives ?? []) {
                  if (a?.slug) anchorBySlug.set(a.slug, a.anchorText || a.name || pretty(a.slug));
                }

                setDesc(data?.editorialDescription || '');
                setLinks(
                  slugs.map((slug) => ({
                    slug,
                    anchorText: anchorBySlug.get(slug) || pretty(slug),
                  }))
                );
                return; // success via graph path
              } catch {
                // fall through to full API fallback
              }
            }
          } catch {
            // fall through
          }
        }

        // Fallback: use API's computed list directly
        const res = await fetch(
          `${base}/api/whops/${encodeURIComponent(currentWhopSlug)}/alternatives`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setDesc(data?.editorialDescription || '');
        setLinks(
          (data?.alternatives ?? [])
            .slice(0, 6)
            .map((a: any) => ({
              slug: a.slug,
              anchorText: a.anchorText || a.name || pretty(a.slug),
            }))
        );
      } catch (e: any) {
        setErr(e?.message || 'Failed to load alternatives');
      }
    })();
  }, [currentWhopSlug]);

  if (err || links.length === 0) return null;

  return (
    <section className="mt-12 space-y-4">
      <h2 className="text-xl font-semibold">You might also consider…</h2>
      {desc ? <p className="text-muted-foreground">{desc}</p> : null}
      <ul className="list-disc pl-5 space-y-2">
        {links.map((alt) => (
          <li key={alt.slug}>
            <Link href={`/whop/${alt.slug}`} className="underline">
              {alt.anchorText}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}