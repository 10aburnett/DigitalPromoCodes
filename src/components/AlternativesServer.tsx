// src/components/AlternativesServer.tsx
import Link from 'next/link';
import { getAlternatives } from '@/data/recommendations';
import { resolveLogoUrl } from '@/lib/image-url';

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
        {alternatives.map((whop, index) => {
          const logoUrl = resolveLogoUrl(whop.logo);
          console.log('[ALT LOGO]', { slug: whop.slug, rawLogo: whop.logo, resolved: logoUrl });

          return (
            <Link
              key={whop.id}
              href={`/whop/${encodeURIComponent(whop.slug)}`}
              className="block rounded-lg border p-4 hover:opacity-90 transition group"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}
              prefetch
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
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate" style={{ color: 'var(--text-color)' }}>{whop.name}</div>
                  {whop.description && <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{whop.description}</div>}
                  <div className="mt-1 text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border-color)' }}>{getPromoText(whop)}</span>
                    {whop.category && <span>{whop.category}</span>}
                    {typeof whop.rating === 'number' && <span>★ {whop.rating.toFixed(1)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {explore && (
        <div className="mt-6 rounded-lg border p-4"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>
              Explore another{explore.category ? ` in ${explore.category}` : ''}:
            </span>
            <Link href={`/whop/${encodeURIComponent(explore.slug)}`} className="font-medium hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-color)' }} prefetch>
              {explore.name}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
