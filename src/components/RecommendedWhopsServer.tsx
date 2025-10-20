// src/components/RecommendedWhopsServer.tsx
// Pure server component - server-final markup, no client mutations
import 'server-only';
import Link from 'next/link';
import { getRecommendations } from '@/data/recommendations';
import { resolveLogoUrl } from '@/lib/image-url';
import {
  CARD_LINK,
  CARD_ROW,
  CARD_LOGO_WRAPPER,
  CARD_LOGO_IMG,
  CARD_TITLE,
  CARD_DESC,
  CARD_META,
  CARD_BADGE,
  CARD_CONTAINER,
  SECTION_HEADING,
  SECTION_SUBTITLE
} from './whop/cardStyles';

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

  // Don't show section if no recommendations - return null to hide completely
  // This is safe because this is a server component with stable data
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="mt-8" data-recs data-recs-count={recommendations.length}>
      <h2 className={SECTION_HEADING}>Recommended for You</h2>
      <p className={SECTION_SUBTITLE} style={{ color: 'var(--text-secondary)' }}>
        Similar offers based on your current selection
      </p>

      <ul className={CARD_ROW}>
        {recommendations.map((whop, index) => {
          const logoUrl = resolveLogoUrl(whop.logo);
          const href = `/whop/${encodeURIComponent(whop.slug)}`;

          return (
            <li key={whop.slug}>
              <Link
                href={href}
                prefetch={false}
                className={`${CARD_LINK} focus-visible:ring-[var(--accent-color)]`}
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}
                aria-label={`View ${whop.name}`}
              >
                <div className={CARD_CONTAINER}>
                  <div className={CARD_LOGO_WRAPPER}>
                    <img
                      src={logoUrl}
                      alt={whop.name}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className={CARD_LOGO_IMG}
                    />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className={CARD_TITLE} style={{ color: 'var(--text-color)' }}>{whop.name}</div>
                    {whop.description && <div className={CARD_DESC} style={{ color: 'var(--text-secondary)' }}>{whop.description}</div>}
                    <div className={CARD_META} style={{ color: 'var(--text-secondary)' }}>
                      <span className={CARD_BADGE} style={{ borderColor: 'var(--border-color)' }}>{getPromoText(whop)}</span>
                      {whop.category && <span>{whop.category}</span>}
                      {typeof whop.rating === 'number' && <span>★ {whop.rating.toFixed(1)}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {explore && (
        <div className="mt-3">
          <Link
            href={`/whop/${encodeURIComponent(explore.slug)}`}
            prefetch={false}
            className="text-sm underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent-color)' }}
          >
            Explore {explore.name}{explore.category ? ` in ${explore.category}` : ''}
          </Link>
        </div>
      )}
    </section>
  );
}
