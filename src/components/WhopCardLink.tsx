'use client';

import { useState, useEffect } from 'react';
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
  const [imageState, setImageState] = useState<{ imagePath: string; imageError: boolean }>({
    imagePath: '',
    imageError: false
  });

  useEffect(() => {
    // Initialize image state
    if (!imageUrl ||
        imageUrl.trim() === '' ||
        imageUrl === 'null' ||
        imageUrl === 'undefined' ||
        imageUrl === 'NULL' ||
        imageUrl === 'UNDEFINED') {
      setImageState({ imagePath: '', imageError: true });
      return;
    }

    let normalizedPath = normalizeImagePath(imageUrl);

    // If the path is empty or clearly invalid, go straight to InitialsAvatar
    if (!normalizedPath ||
        normalizedPath.trim() === '' ||
        normalizedPath === '/images/.png' ||
        normalizedPath === '/images/undefined.png' ||
        normalizedPath === '/images/Simplified Logo.png' ||
        normalizedPath === '/images/null.png' ||
        normalizedPath === '/images/NULL.png' ||
        normalizedPath === '/images/UNDEFINED.png' ||
        normalizedPath.endsWith('/.png') ||
        normalizedPath.includes('/images/undefined') ||
        normalizedPath.includes('/images/null') ||
        normalizedPath.includes('Simplified Logo')) {
      setImageState({ imagePath: '', imageError: true });
      return;
    }

    setImageState({ imagePath: normalizedPath, imageError: false });
  }, [imageUrl]);

  // Load alternative logo paths to try
  const getAlternativeLogoPaths = (whopName: string, originalPath: string) => {
    const cleanName = whopName.replace(/[^a-zA-Z0-9]/g, '');
    return [
      `/images/${whopName} Logo.png`,
      `/images/${whopName.replace(/\s+/g, '')} Logo.png`,
      `/images/${cleanName} Logo.png`,
      `/images/${cleanName}Logo.png`,
      '/images/Simplified Logo.png'
    ];
  };

  // Try next image in case of error
  const handleImageError = () => {
    const { imagePath } = imageState;
    console.error(`Image failed to load: ${imagePath} for ${title}`);

    // If the current path has @avif, try without it first
    if (imagePath.includes('@avif')) {
      const pathWithoutAvif = imagePath.replace('@avif', '');
      console.log(`Trying without @avif: ${pathWithoutAvif}`);
      setImageState({ ...imageState, imagePath: pathWithoutAvif });
      return;
    }

    // If the path looks like a placeholder or default image, go straight to InitialsAvatar
    if (imagePath.includes('Simplified Logo') ||
        imagePath.includes('default') ||
        imagePath.includes('placeholder') ||
        imagePath.includes('no-image') ||
        imagePath.includes('missing')) {
      console.log(`Placeholder detected, showing initials for ${title}`);
      setImageState({ ...imageState, imageError: true });
      return;
    }

    // Get alternative paths
    const alternativePaths = getAlternativeLogoPaths(title, imagePath);
    const currentIndex = alternativePaths.indexOf(imagePath);

    if (currentIndex < alternativePaths.length - 1) {
      // Try next alternative
      const nextPath = alternativePaths[currentIndex + 1];
      console.log(`Trying alternative path: ${nextPath}`);
      setImageState({ ...imageState, imagePath: nextPath });
    } else {
      // All alternatives failed, show initials
      console.log(`All image paths failed for ${title}, showing initials`);
      setImageState({ ...imageState, imageError: true });
    }
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
              if (imageState.imageError || !imageState.imagePath || imageState.imagePath.trim() === '') {
                return (
                  <InitialsAvatar
                    name={title}
                    size="md"
                    shape="square"
                    className="w-full h-full"
                  />
                );
              }
              return (
                <Image
                  src={imageState.imagePath}
                  alt={`${title} logo`}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                  onError={handleImageError}
                  unoptimized={imageState.imagePath.includes('@avif')}
                  sizes="64px"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                  loading={priority ? "eager" : "lazy"}
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
              {rating && rating > 0 && (
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