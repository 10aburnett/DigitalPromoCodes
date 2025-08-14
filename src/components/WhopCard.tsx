'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { normalizeImagePath } from '@/lib/image-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocialProof, createSocialProofFromWhop } from '@/contexts/SocialProofContext';
import InitialsAvatar from './InitialsAvatar';

// Define the promo type directly here to avoid import issues
interface Promo {
  id: string;
  whopName: string;
  slug?: string; // Add slug property
  promoType: string;
  promoValue: number;
  promoText: string;
  logoUrl: string;
  promoCode?: string | null;
  affiliateLink: string;
  isActive: boolean;
  price?: string | null; // Add price field
  // Add the whopId field for tracking
  whopId?: string;
  // Add the promoCodeId field for tracking
  promoCodeId?: string;
}

interface WhopCardProps {
  promo: Promo;
  priority?: boolean; // For prioritizing above-the-fold images
}

export default function WhopCard({ promo, priority = false }: WhopCardProps) {
  const { t, language, isHydrated } = useLanguage();
  const { addNotification } = useSocialProof();
  const [imageError, setImageError] = useState(false);
  const [imagePath, setImagePath] = useState('');
  const pathname = usePathname();

  // Helper function to get the correct detail page URL based on language
  const getDetailPageUrl = () => {
    // Use slug if available, otherwise fall back to id
    const identifier = promo.slug || promo.id;
    
    // More reliable language detection using pathname
    let currentLanguage = language;
    
    // Always use pathname as the source of truth for current language
    if (pathname) {
      const pathSegments = pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0 && ['es', 'nl', 'fr', 'de', 'it', 'pt', 'zh'].includes(pathSegments[0])) {
        currentLanguage = pathSegments[0] as any;
      } else {
        currentLanguage = 'en'; // Default to English if no valid language prefix
      }
    }
    
    // Fallback for when pathname is not available (SSR)
    if (!currentLanguage || currentLanguage === 'en') {
      if (!isHydrated && typeof window !== 'undefined') {
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0 && ['es', 'nl', 'fr', 'de', 'it', 'pt', 'zh'].includes(pathSegments[0])) {
          currentLanguage = pathSegments[0] as any;
        }
      }
    }
    
    if (currentLanguage === 'en') {
      return `/whop/${identifier}`; // English uses /whop/{slug}
    }
    return `/${currentLanguage}/${identifier}`; // Other languages use direct language prefix with whop pages under locale
  };

  const handleGetPromoClick = (e: React.MouseEvent) => {
    console.log("🔥 WhopCard: Get Promo button clicked!", {
      whopName: promo.whopName,
      whopId: promo.whopId,
      promoCodeId: promo.promoCodeId,
      hasWhopId: !!promo.whopId,
      hasPromoCodeId: !!promo.promoCodeId,
      timestamp: new Date().toISOString()
    });
    
    // Don't stop propagation - allow the link to work normally
    
    // Track the click event - now works even without promo code ID
    if (promo.whopId) {
      console.log("✅ WhopCard: Whop ID present, calling trackOfferClick");
      trackOfferClick(promo.whopId, promo.promoCodeId || null);
    } else {
      console.warn("⚠️ WhopCard: Missing whop ID:", promo.whopId);
    }

    // Trigger social proof notification
    const socialProofData = createSocialProofFromWhop({
      whopName: promo.whopName,
      promoCode: promo.promoCode,
      promoValue: promo.promoValue,
      promoType: promo.promoType,
      promoText: promo.promoText,
    });
    addNotification(socialProofData);
  };

  const handleViewDealClick = (e: React.MouseEvent) => {
    // Only navigation to deal page, no social proof notification
    // (User will see their own action on the same website)
  };

  const trackOfferClick = async (whopId: string, promoCodeId: string | null) => {
    console.log("🔥 WhopCard: trackOfferClick called with:", {
      whopId,
      promoCodeId,
      whopName: promo.whopName,
      timestamp: new Date().toISOString()
    });
    
    try {
      const requestBody = {
        casinoId: whopId, // Using whopId as casinoId for compatibility
        bonusId: promoCodeId, // Using promoCodeId as bonusId for compatibility (can be null)
        actionType: 'code_copy',
      };
      
      console.log("📤 WhopCard: Sending tracking request:", requestBody);
      
      const response = await fetch('/api/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ WhopCard: Tracking successful:", result);
      } else {
        const errorData = await response.text();
        console.error("❌ WhopCard: Tracking failed:", response.status, errorData);
      }
    } catch (error) {
      console.error("❌ WhopCard: Error tracking offer click:", error);
    }
  };

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
    console.error(`Image failed to load: ${imagePath} for ${promo.whopName}`);
    
    // If the current path has @avif, try without it first
    if (imagePath.includes('@avif')) {
      const pathWithoutAvif = imagePath.replace('@avif', '');
      console.log(`Trying without @avif: ${pathWithoutAvif}`);
      setImagePath(pathWithoutAvif);
      return;
    }
    
    // If the path looks like a placeholder or default image, go straight to InitialsAvatar
    if (imagePath.includes('Simplified Logo') || 
        imagePath.includes('default') || 
        imagePath.includes('placeholder') ||
        imagePath.includes('no-image') ||
        imagePath.includes('missing')) {
      console.log(`Placeholder detected, showing initials for ${promo.whopName}`);
      setImageError(true);
      return;
    }
    
    // Get alternative paths
    const alternativePaths = getAlternativeLogoPaths(promo.whopName, imagePath);
    const currentIndex = alternativePaths.indexOf(imagePath);
    
    if (currentIndex < alternativePaths.length - 1) {
      // Try next alternative
      const nextPath = alternativePaths[currentIndex + 1];
      console.log(`Trying alternative path: ${nextPath}`);
      setImagePath(nextPath);
    } else {
      // All alternatives failed, show initials
      console.log(`All image paths failed for ${promo.whopName}, showing initials`);
      setImageError(true);
    }
  };

  // Determine the best logo path when component mounts
  useEffect(() => {
    try {
      // Check if logoUrl is empty/null/undefined first
      if (!promo.logoUrl || 
          promo.logoUrl.trim() === '' || 
          promo.logoUrl === 'null' || 
          promo.logoUrl === 'undefined' ||
          promo.logoUrl === 'NULL' ||
          promo.logoUrl === 'UNDEFINED') {
        setImageError(true);
        setImagePath(''); // Clear the path
        return;
      }

      let normalizedPath = normalizeImagePath(promo.logoUrl);
      
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
        setImageError(true);
        setImagePath(''); // Clear the path
        return;
      }
      
      setImagePath(normalizedPath);
      setImageError(false); // Reset error state when path changes
      
    } catch (error) {
      console.error(`Error setting image path for ${promo.whopName}:`, error);
      setImageError(true);
      setImagePath(''); // Clear the path
    }
  }, [promo.logoUrl, promo.whopName]);

  return (
    <div className="relative">
      <article className="relative p-5 rounded-xl shadow-lg border transition-all hover:shadow-xl hover:border-opacity-50" style={{ background: 'linear-gradient(135deg, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}>
        <Link 
          href={getDetailPageUrl()}
          className="block"
          title={`${promo.whopName} Promo Code - ${promo.promoText} (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`}
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-800" style={{ backgroundColor: 'var(--background-color)' }}>
              {imageError || !imagePath || imagePath.trim() === '' ? (
                <InitialsAvatar 
                  name={promo.whopName} 
                  size="lg" 
                  shape="square"
                  className="w-full h-full"
                />
              ) : (
                <Image
                  src={imagePath}
                  alt={`${promo.whopName} Promo Code - ${promo.promoText} (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                  onError={handleImageError}
                  priority={priority}
                  unoptimized={imagePath.includes('@avif')}
                  sizes="(max-width: 768px) 48px, 64px"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate" style={{ color: 'var(--text-color)' }}>{promo.whopName}</h2>
              <p className="text-base mt-1" style={{ color: 'var(--accent-color)' }}>{promo.promoText}</p>
              {promo.price && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-semibold px-2 py-1 rounded-full" style={{ 
                    backgroundColor: promo.price === 'Free' ? 'var(--success-color)' : 
                                    promo.price === 'N/A' ? 'var(--text-secondary)' : 'var(--success-color)', 
                    color: 'white' 
                  }}>
                    {promo.price}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Link>

        <a
          href={promo.affiliateLink || '#'}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="w-full font-bold py-3 px-4 rounded-lg text-center transition-all duration-200 block hover:opacity-90 hover:scale-[1.02] transform-gpu border"
          style={{ 
            backgroundColor: 'var(--background-secondary)', 
            color: 'var(--text-color)',
            borderColor: 'var(--border-color)'
          }}
          onClick={handleGetPromoClick}
        >
          {t('whop.getPromo')}
        </a>

        <div className="mt-2">
          <Link 
            href={getDetailPageUrl()}
            className="w-full font-bold py-3 px-4 rounded-lg text-center transition-all duration-200 block hover:opacity-90 hover:scale-[1.02] transform-gpu"
            style={{ 
              backgroundColor: 'var(--accent-color)', 
              color: 'white'
            }}
            onClick={handleViewDealClick}
          >
            {t('whop.viewDeal')}
          </Link>
        </div>
      </article>
    </div>
  );
}
