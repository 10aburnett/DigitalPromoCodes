// No "use client" here
import Image from 'next/image';
import Link from 'next/link';

// Helper: normalize relative URLs to absolute for image optimizer
function normalizeImg(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!base) return url; // fallback
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

export function ServerWhopCard(props: {
  slug: string; title: string; subtitle?: string | null;
  imageUrl?: string | null; badgeText?: string | null;
  category?: string | null; rating?: number | null;
}) {
  const { slug, title, subtitle, imageUrl, badgeText, category, rating } = props;
  const src = normalizeImg(imageUrl);

  return (
    <Link href={`/offer/${slug}`} className="block rounded-lg border p-4 hover:opacity-90 transition"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}>
      <div className="flex gap-3 items-center">
        <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--background-secondary)] shrink-0">
          {src ? (
            <Image
              src={src}
              alt={title}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : <div className="w-full h-full" />}
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ color: 'var(--text-color)' }}>{title}</div>
          {subtitle && <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{subtitle}</div>}
          <div className="mt-1 text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
            {badgeText && <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border-color)' }}>{badgeText}</span>}
            {category && <span>{category}</span>}
            {typeof rating === 'number' && <span>★ {rating.toFixed(1)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
