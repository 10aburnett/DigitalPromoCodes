// src/components/RecommendedWhopsServer.tsx
import Link from 'next/link';
import WhopCardLink from './WhopCardLink';
import SectionPanel from './SectionPanel';
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
    <SectionPanel
      title="Recommended for You"
      subtitle="Similar offers based on your current selection"
    >
      {/* Single column layout for better alignment within constrained width */}
      <div className="space-y-4">
        {recommendations.map((whop, index) => (
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
            priority={index < 2} // Prefetch first 2 for better SEO and performance
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

      {/* View More Link - SEO-friendly with consistent URL structure */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-80 hover:scale-105"
          style={{
            color: 'var(--accent-color)',
            border: '1px solid var(--accent-color)'
          }}
        >
          Explore All Offers
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* JSON-LD Structured Data for SEO */}
      {recommendations.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "name": "Recommended for You",
              "itemListElement": recommendations.map((whop, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "url": `${getBaseUrl()}/whop/${whop.slug}`
              }))
            })
          }}
        />
      )}
    </SectionPanel>
  );
}
