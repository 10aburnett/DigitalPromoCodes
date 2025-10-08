// src/components/AlternativesServer.tsx
import Link from 'next/link';
import WhopCardLink from './WhopCardLink';
import SectionPanel from './SectionPanel';
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
    <div className="mt-12">
      <SectionPanel
        title="You might also consider…"
        subtitle="Alternative offers that might interest you"
      >
        <div className="space-y-4">
          {alternatives.map((whop, index) => (
            <WhopCardLink
              key={whop.id}
              slug={whop.slug}
              title={whop.name}
              subtitle={whop.description}
              priceText={whop.price}
              imageUrl={whop.logo}
              badgeText={getPromoText(whop)}
              category={whop.category}
              rating={whop.rating ?? undefined}
              priority={index < 2} // Prefetch first 2
            />
          ))}
        </div>

        {/* Explore link (optional, small + unobtrusive) */}
        {explore && (
          <div
            className="mt-6 rounded-lg border p-4"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                Explore another{explore.category ? ` in ${explore.category}` : ''}:
              </span>
              <Link
                href={`/whop/${explore.slug}`}
                className="inline-flex items-center font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--accent-color)' }}
              >
                {explore.name}
                <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* JSON-LD Structured Data for SEO */}
        {alternatives.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "You might also consider…",
                "itemListElement": alternatives.map((whop, index) => ({
                  "@type": "ListItem",
                  "position": index + 1,
                  "url": `${getBaseUrl()}/whop/${whop.slug}`
                }))
              })
            }}
          />
        )}
      </SectionPanel>
    </div>
  );
}
