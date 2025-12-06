import 'server-only';

interface WhopMiniPreviewProps {
  slug: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  category?: string | null;
  rating?: number | null;
  ratingCount?: number;
  isExploreLink?: boolean;
}

export default function WhopMiniPreview({
  slug,
  name,
  logo,
  description,
  category,
  rating,
  ratingCount = 0,
  isExploreLink = false
}: WhopMiniPreviewProps) {
  const href = `/offer/${encodeURIComponent(slug)}`;

  // Compute display values with safe fallbacks
  const badge = (category && category.trim()) ? category : 'Exclusive Access';
  // Clamp rating between 0-5 for display consistency
  const r = Math.min(5, Math.max(0, Number(rating) || 0));
  const rc = typeof ratingCount === 'number' && ratingCount >= 0 ? ratingCount : 0;

  return (
    <li className="group block rounded-lg border overflow-hidden hover:shadow-md transition-all duration-200" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
      <a
        href={href}
        className="flex gap-4 p-4 focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-inset"
        aria-label={isExploreLink ? `Explore another: ${name}` : name}
      >
        {/* Logo with subtle background */}
        <div className="flex-shrink-0">
          <img
            src={logo || '/logo.png'}
            alt={`${name} logo`}
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            className="w-14 h-14 rounded-lg object-contain p-1"
            style={{ backgroundColor: 'var(--background-color)' }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Top row: Title + Rating */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-semibold text-base line-clamp-1 group-hover:text-[var(--accent-color)] transition-colors">
              {isExploreLink ? (
                <>Discover: {name}</>
              ) : (
                name
              )}
            </h3>

            {/* Compact rating badge */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs flex-shrink-0"
              style={{ backgroundColor: 'var(--background-color)' }}
              aria-label={`${r.toFixed(1)} stars from ${rc} reviews`}
            >
              <span className="text-amber-500">★</span>
              <span style={{ color: 'var(--text-color)' }}>{r.toFixed(1)}</span>
            </div>
          </div>

          {/* Category pill */}
          <span
            className="inline-block text-xs px-2 py-0.5 rounded mb-2"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              opacity: 0.9
            }}
          >
            {badge}
          </span>

          {/* Description */}
          {description && (
            <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}
        </div>

        {/* Right arrow indicator */}
        <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-5 h-5" style={{ color: 'var(--accent-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </a>
    </li>
  );
}
