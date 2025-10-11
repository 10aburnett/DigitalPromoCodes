// src/components/AlternativesServer.tsx
import Link from 'next/link';
import { ServerWhopCard } from './_ServerWhopCard';
import { getAlternatives } from '@/data/recommendations';

interface PromoCode {
  id: string;
  title: string;
  type: string;
  value: string;
  code: string | null;
}

interface AlternativeWhop {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  category: string | null;
  price: string | null;
  rating: number | null;
  promoCodes: PromoCode[];
}

function getPromoText(whop: AlternativeWhop) {
  const firstPromo = whop.promoCodes?.[0];
  if (!firstPromo) return 'Exclusive Access';

  // If there's a promo code and a value > 0, show the discount
  if (firstPromo.code && firstPromo.value && firstPromo.value !== '0') {
    // Check if value already contains currency or percentage symbol
    if (firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off')) {
      return firstPromo.value;
    }
    return `${firstPromo.value}% Off`;
  }

  return firstPromo.title || 'Exclusive Access';
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN;
  return 'https://whpcodes.com';
}

export default async function AlternativesServer({ currentWhopSlug }: { currentWhopSlug: string }) {
  const { items: alternatives, explore } = await getAlternatives(currentWhopSlug);

  // Don't show section if no alternatives
  if (alternatives.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-1">You might also consider…</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Alternative offers that might interest you
      </p>

      <div className="space-y-4">
        {alternatives.map((whop, index) => (
          <ServerWhopCard
            key={whop.id}
            slug={whop.slug}
            title={whop.name}
            subtitle={whop.description}
            imageUrl={whop.logo}
            badgeText={getPromoText(whop)}
            category={whop.category}
            rating={whop.rating ?? undefined}
          />
        ))}
      </div>

      {explore && (
        <div className="mt-6 rounded-lg border p-4"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>
              Explore another{explore.category ? ` in ${explore.category}` : ''}:
            </span>
            <Link href={`/whop/${explore.slug}`} className="font-medium hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-color)' }}>
              {explore.name}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
