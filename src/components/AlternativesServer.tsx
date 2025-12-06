import 'server-only';
import WhopMiniPreview from './WhopMiniPreview';
import { resolveLogoUrl } from '@/lib/image-url';

type Item = {
  slug: string;
  name: string;
  logo?: string | null;
  blurb?: string | null;
  category?: string | null;
  rating?: number | null;
  ratingCount?: number;
};

type ExploreLink = {
  slug: string;
  name: string;
  logo?: string | null;
  blurb?: string | null;
  category?: string | null;
  rating?: number | null;
  ratingCount?: number;
};

export default function AlternativesServer({
  items,
  explore
}: {
  items?: Item[];
  explore?: ExploreLink | null;
}) {
  const list = (items ?? [])
    .filter((w): w is Item & { slug: string } => !!w && !!w.slug)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (!list.length && !explore) return null;

  return (
    <section aria-label="Other options" className="mt-8">
      <h2 className="text-xl font-bold mb-4">Other Options</h2>
      <ul className="flex flex-col gap-4" suppressHydrationWarning>
        {list.map((w, i) => (
          <WhopMiniPreview
            key={`${w.slug}#${i}`}
            slug={w.slug}
            name={w.name}
            logo={resolveLogoUrl(w.logo)}
            description={w.blurb}
            category={w.category}
            rating={w.rating}
            ratingCount={w.ratingCount ?? 0}
          />
        ))}

        {/* Render explore link as a special preview card */}
        {explore && (
          <WhopMiniPreview
            key={`explore-${explore.slug}`}
            slug={explore.slug}
            name={explore.name}
            logo={resolveLogoUrl(explore.logo)}
            description={explore.blurb}
            category={explore.category}
            rating={explore.rating}
            ratingCount={explore.ratingCount ?? 0}
            isExploreLink={true}
          />
        )}
      </ul>
    </section>
  );
}
