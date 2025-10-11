// No "use client" here
import Image from 'next/image';
import Link from 'next/link';

export function ServerWhopCard(props: {
  slug: string; title: string; subtitle?: string | null;
  imageUrl?: string | null; badgeText?: string | null;
  category?: string | null; rating?: number | null;
}) {
  const { slug, title, subtitle, imageUrl, badgeText, category, rating } = props;
  return (
    <Link href={`/whop/${slug}`} className="block rounded-lg border p-4 hover:opacity-90 transition"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}>
      <div className="flex gap-3 items-center">
        <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--background-secondary)] shrink-0">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} width={48} height={48} className="w-full h-full object-cover" />
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
