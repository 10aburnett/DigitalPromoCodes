// src/components/RecommendedWhopsServer.tsx
// Pure server component - server-final markup, no client mutations
import 'server-only';
import Link from 'next/link';
import crypto from 'crypto';
import { getRecommendations } from '@/data/recommendations';
import { resolveLogoUrl } from '@/lib/image-url';

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
  // Debug log to verify slug is decoded/normalized
  console.log('[Recommended] server slug:', currentWhopSlug);

  const { items: recommendations, explore } = await getRecommendations(currentWhopSlug);

  // Don't show section if no recommendations - return null to hide completely
  // This is safe because this is a server component with stable data
  if (recommendations.length === 0) {
    return null;
  }

  // Debug: Generate checksum to verify data stability between SSR and client
  const checksum = crypto
    .createHash('md5')
    .update(JSON.stringify(recommendations.map(r => r.slug)))
    .digest('hex');
  console.log('[SSR RECS CHECKSUM]', currentWhopSlug, checksum, recommendations.length);

  return (
    <section className="mt-10 w-full max-w-6xl mx-auto mb-8" data-recs data-recs-count={recommendations.length}>
      <h2 className="text-xl sm:text-2xl font-bold mb-2">Recommended for You</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Similar offers based on your current selection
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden">
        {recommendations.map((whop, index) => {
          const logoUrl = resolveLogoUrl(whop.logo);
          const href = `/whop/${encodeURIComponent(whop.slug)}`;
          console.log('[REC LOGO]', { slug: whop.slug, rawLogo: whop.logo, resolved: logoUrl, href });

          return (
            <li key={whop.slug}>
              <Link
                href={href}
                prefetch={false}
                className="block rounded-lg border p-4 hover:shadow-md hover:opacity-95 transition-all duration-200 group overflow-hidden"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}
                aria-label={`View ${whop.name}`}
              >
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--background-secondary)] shrink-0">
                    <img
                      src={logoUrl}
                      alt={whop.name}
                      width={48}
                      height={48}
                      loading={index < 2 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="font-semibold line-clamp-2 break-words mb-1" style={{ color: 'var(--text-color)' }}>{whop.name}</div>
                    {whop.description && <div className="text-sm line-clamp-2 break-words" style={{ color: 'var(--text-secondary)' }}>{whop.description}</div>}
                    <div className="mt-1 text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border-color)' }}>{getPromoText(whop)}</span>
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
