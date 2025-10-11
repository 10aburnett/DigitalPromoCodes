// src/components/RecommendedWhopsServer.tsx
import Link from 'next/link';
import { ServerWhopCard } from './_ServerWhopCard';
import { getRecommendations } from '@/data/recommendations';

interface PromoCode {
  id: string;
  title: string;
  type: string;
  value: string;
  code: string | null;
}

interface RecommendedWhop {
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

interface RecommendedWhopsServerProps {
  currentWhopSlug: string;
}

function getPromoText(whop: RecommendedWhop) {
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

export default async function RecommendedWhopsServer({ currentWhopSlug }: RecommendedWhopsServerProps) {
  const { items: recommendations, explore } = await getRecommendations(currentWhopSlug);

  // Don't show section if no recommendations
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-1">Recommended for You</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Similar offers based on your current selection
      </p>

      <div className="space-y-4">
        {recommendations.map((whop, index) => (
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
