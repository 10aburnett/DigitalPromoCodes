'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { normalizeImagePath } from '@/lib/image-utils';
import InitialsAvatar from './InitialsAvatar';

interface WhopCardLinkProps {
  slug: string;
  title: string;          // what users see (use anchorText for Alternatives; use whop.name for Recs)
  subtitle?: string;      // short description
  priceText?: string;     // formatted price if you have it
  imageUrl?: string | null;
  badgeText?: string;     // e.g., "Exclusive Access"
  category?: string | null;
  rating?: number;
  priority?: boolean;     // for prefetch optimization
}

export default function WhopCardLink({
  slug,
  title,
  subtitle,
  priceText,
  imageUrl,
  badgeText,
  category,
  rating,
  priority = false
}: WhopCardLinkProps) {

  // Debug logging to find the mystery "0"
  if (process.env.NODE_ENV === 'development' && rating === 0) {
    console.log('WhopCardLink received rating=0 for:', title, { rating, slug });
  }
  const [imageState, setImageState] = useState<{ imagePath: string; imageError: boolean }>({
    imagePath: '',
    imageError: false
  });

  // Precompute candidate alt paths ONCE per (title, imageUrl)
  const altPaths = useMemo(() => {
    const name = title?.trim() || '';
    const clean = name.replace(/[^a-zA-Z0-9]/g, '');
    return [
      `/images/${name} Logo.png`,
      `/images/${name.replace(/\s+/g, '')} Logo.png`,
      `/images/${clean} Logo.png`,
      `/images/${clean}Logo.png`,
    ];
  }, [title, imageUrl]);

  // Track position in altPaths and whether we've already stripped @avif
  const altIdxRef = useRef(0);
  const strippedRef = useRef(false);

  useEffect(() => {
    // Initialize from imageUrl (your normalizeImagePath logic is fine)
    // If invalid → go straight to initials (no attempts)
    const url = (imageUrl || '').trim();
    const normalized = url ? normalizeImagePath(url) : '';
    if (
      !normalized ||
      normalized === '/images/.png' ||
      normalized.endsWith('/.png') ||
      normalized.includes('/images/undefined') ||
      normalized.includes('/images/null') ||
      normalized.includes('Simplified Logo')
    ) {
      setImageState({ imagePath: '', imageError: true });
      return;
    }
    setImageState({ imagePath: normalized, imageError: false });
    altIdxRef.current = 0;       // reset attempts when source changes
    strippedRef.current = false;
  }, [imageUrl]);


  // Single-shot handler: at most two attempts → initials
  const handleImageError = () => {
    const src = imageState.imagePath || '';

    // First: if the current path had @avif, try once without it
    if (src.includes('@avif') && !strippedRef.current) {
      strippedRef.current = true;
      setImageState(s => ({ ...s, imagePath: src.replace('@avif', '') }));
      return;
    }

    // Second: try ONE alternative path from the memoized list
    if (altIdxRef.current < altPaths.length) {
      const next = altPaths[altIdxRef.current++];
      setImageState(s => ({ ...s, imagePath: next }));
      return;
    }

    // Done: render initials and never attempt again
    setImageState(s => ({ ...s, imageError: true }));
  };

  const truncateDescription = (text: string | undefined, maxLength: number = 100) => {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength).trim() + '...';
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return null;

    return (
      <span className="text-xs px-2 py-1 rounded-full font-medium mb-2 inline-block"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-secondary)'
            }}>
        {category}
      </span>
    );
  };

  return (
    <Link
      href={`/whop/${slug.toLowerCase()}`}
      className="group block"
      prefetch={priority}
      aria-label={title}
    >
      <div className="rounded-lg p-4 border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group-hover:border-opacity-70"
           style={{
             backgroundColor: 'var(--background-color)',
             borderColor: 'var(--border-color)',
             boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
           }}>
        <div className="flex items-center gap-4">
          {/* Logo Section - Fixed 64px width/height to prevent CLS */}
          <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-800 flex items-center justify-center">
            {(() => {
              if (imageState.imageError || !imageState.imagePath?.trim()) {
                return (
                  <InitialsAvatar
                    name={title}
                    size="md"
                    shape="square"
                    className="w-full h-full"
                  />
                );
              }

              const isLocal = imageState.imagePath.startsWith('/');
              const unoptimized = isLocal || imageState.imagePath.includes('@avif');

              return (
                <Image
                  src={imageState.imagePath}
                  alt={`${title} logo`}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                  onError={handleImageError}
                  unoptimized={unoptimized}
                  sizes="64px"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                  loading={priority ? 'eager' : 'lazy'}
                />
              );
            })()}
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            {/* Category badge */}
            {getCategoryBadge(category)}

            {/* Title and Rating */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm sm:text-base leading-tight group-hover:opacity-80 transition-opacity line-clamp-2 flex-1"
                  style={{ color: 'var(--text-color)' }}>
                {title}
              </h3>
              {rating > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-yellow-400 text-xs">★</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {subtitle && (
              <p className="text-xs sm:text-sm leading-relaxed line-clamp-2 mb-3"
                 style={{ color: 'var(--text-secondary)' }}>
                {truncateDescription(subtitle)}
              </p>
            )}

            {/* Footer with badge and price */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {badgeText && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-color)',
                        color: 'white'
                      }}>
                  {badgeText}
                </span>
              )}

              {priceText && (
                <span className="
                  order-2 md:order-none
                  basis-full md:basis-auto
                  w-full md:w-auto
                  text-right md:text-left
                  md:ml-auto
                  text-xs font-semibold
                  leading-tight
                  truncate md:whitespace-nowrap
                  max-w-full
                "
                      style={{
                        color: priceText === 'Free' ? 'var(--success-color)' : 'var(--text-secondary)'
                      }}>
                  {priceText}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}