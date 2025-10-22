import 'server-only';

type Item = {
  slug: string;
  name: string;
  logo?: string | null;
  blurb?: string | null;
};

export default function AlternativesServer({ items, exploreHref }: { items?: Item[]; exploreHref?: string }) {
  const list = (items ?? [])
    .filter((w): w is Item & { slug: string } => !!w && !!w.slug)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (!list.length) return null;

  return (
    <section aria-label="Similar offers" className="mt-8">
      <h2 className="text-xl font-bold mb-4">Similar offers</h2>
      <ul className="flex flex-col gap-4" suppressHydrationWarning>
        {list.map((w, i) => (
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
                <div className="text-sm text-[var(--text-secondary)] line-clamp-2">{w.blurb || '\u00A0'}</div>
              </div>
            </a>
          </li>
        ))}
      </ul>

      {exploreHref ? (
        <div className="mt-4">
          <a href={exploreHref} className="underline hover:opacity-80">
            Explore more
          </a>
        </div>
      ) : null}
    </section>
  );
}
