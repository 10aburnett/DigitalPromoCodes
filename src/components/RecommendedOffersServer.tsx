// Server-safe list of recommended whops (no next/link, no client state)
import 'server-only';
import WhopMiniPreview from './WhopMiniPreview';
import { resolveLogoUrl } from '@/lib/image-url';

type Item = {
  slug: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  blurb?: string | null;
  category?: string | null;
  rating?: number | null;
  ratingCount?: number;
};

export default function RecommendedWhopsServer({ items }: { items?: Item[] }) {
  const list = (items ?? [])
    .filter((w): w is Item & { slug: string } => !!w && !!w.slug)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (!list.length) return null;

  return (
    <section aria-label="You might also like" className="mt-8">
      <h2 className="text-xl font-bold mb-4">You Might Also Like</h2>
      <ul className="flex flex-col gap-4" suppressHydrationWarning>
        {list.map((w, i) => (
          <WhopMiniPreview
            key={`${w.slug}#${i}`}
            slug={w.slug}
            name={w.name}
            logo={resolveLogoUrl(w.logo)}
            description={w.blurb || w.description}
            category={w.category}
            rating={w.rating}
            ratingCount={w.ratingCount ?? 0}
          />
        ))}
      </ul>
    </section>
  );
}
