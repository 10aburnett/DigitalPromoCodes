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
    <li className="block rounded-xl border p-4 hover:border-[var(--accent-color)] transition">
      <a
        href={href}
        className="flex gap-3 items-start focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
        aria-label={isExploreLink ? `Explore another: ${name}` : name}
      >
        <img
          src={logo || '/logo.png'}
          alt={`${name} logo`}
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="w-12 h-12 rounded object-contain bg-[var(--background-secondary)] flex-shrink-0"
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          {/* Category badge - always show with fallback */}
          <span
            className="text-xs px-2 py-1 rounded-full font-medium mb-1.5 inline-block"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-secondary)'
            }}
          >
            {badge}
          </span>

          {/* Title and Rating Row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="font-semibold text-base line-clamp-2 flex-1">
              {isExploreLink ? (
                <>
                  Explore another: <span className="underline">{name}</span>
                </>
              ) : (
                name
              )}
            </div>

            {/* Star rating with count - always show, even when 0 */}
            <div
              className="flex items-center gap-1 flex-shrink-0"
              aria-label={`${r.toFixed(1)} stars from ${rc} reviews`}
            >
              <span className="text-yellow-400 text-xs">★</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {r.toFixed(1)} <span className="ml-0.5">({String(rc)})</span>
              </span>
            </div>
          </div>

          {/* Description */}
          {description && (
            <div className="text-sm text-[var(--text-secondary)] line-clamp-2">
              {description}
            </div>
          )}
        </div>
      </a>
    </li>
  );
}
