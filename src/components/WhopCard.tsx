'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocialProof, createSocialProofFromWhop } from '@/contexts/SocialProofContext';
import InitialsAvatar from './InitialsAvatar';
import { WhopLogoSSR } from './WhopLogoSSR';
import { whopHref } from '@/lib/paths';
import { resolveLogoUrl } from '@/lib/image-url';

// Define the promo type directly here to avoid import issues
interface Promo {
  id: string;
  whopName: string;
  slug?: string;
  promoType: string;
  promoValue: number;
  promoText: string;
  logoUrl: string;
  promoCode?: string | null;
  affiliateLink: string;
  isActive: boolean;
  price?: string | null;
  priceText?: string;
  priceBadge?: string;
  whopId?: string;
  promoCodeId?: string;
}

interface WhopCardProps {
  promo: Promo;
  priority?: boolean; // For prioritizing above-the-fold images
}

export default function WhopCard({ promo, priority = false }: WhopCardProps) {
  const { t, language, isHydrated } = useLanguage();
  const { addNotification } = useSocialProof();
  const pathname = usePathname();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Robust fallbacks for API shape variations
  const title = (promo as any).title ?? promo.whopName ?? (promo as any).name ?? 'Unknown Whop';

  // Resolve logo URL to absolute path for SSR-safe rendering
  const logoUrl = resolveLogoUrl(promo.logoUrl);

  const discountPercent = typeof (promo as any).discountPercent === 'number' ? (promo as any).discountPercent :
    typeof promo.promoValue === 'number' ? promo.promoValue : null;

  const detailHref =
    (promo as any).href ??
    (promo.slug ? `/whop/${encodeURIComponent(promo.slug)}` :
     promo.id   ? `/whop/${encodeURIComponent(promo.id)}`   : '#');

  const previewText =
    (promo as any).preview ??
    (promo as any).promoText ??
    (promo as any).description ??
    (promo as any).excerpt ??
    '';

  // Get price badge from API
  const rawPriceBadge =
    (promo as any).priceBadge ??
    (promo as any).priceText ??
    (promo as any).price ??
    null;

  // Only show pill if we have a real price (not "Free")
  const priceBadge = rawPriceBadge && rawPriceBadge.toLowerCase() !== 'free'
    ? rawPriceBadge
    : null;

  // Temporary debug logging
  console.log('CARD', {
    slug: promo.slug || promo.id,
    keys: Object.keys(promo),
    priceText: (promo as any).priceText,
    price: (promo as any).price,
    rawPriceBadge,
    priceBadge
  });

  // Helper function to get the correct detail page URL based on language
  const getDetailPageUrl = () => {
    // Use slug if available, otherwise fall back to id
    const identifier = promo.slug || promo.id;

    // Use canonical whopHref helper - handles encoding properly (no double-encoding)
    // This ensures colons are encoded as %3a exactly once
    return whopHref(identifier);
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

  // Intersection Observer for prefetching
  useEffect(() => {
    if (!cardRef.current) return;

    const cardElement = cardRef.current;
    let didPrefetch = false;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !didPrefetch) {
          // Trigger prefetch by simulating mouseover on the link
          const linkElement = cardElement.querySelector('a[href^="/whop/"], a[href*="/whop/"]') as HTMLAnchorElement;
          if (linkElement) {
            linkElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            didPrefetch = true;
          }
        }
      });
    }, { rootMargin: '200px' });

    io.observe(cardElement);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={cardRef} className="relative">
      <article className="relative p-5 rounded-xl shadow-lg border transition-all hover:shadow-xl hover:border-opacity-50" style={{ background: 'linear-gradient(135deg, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}>
        <Link
          href={getDetailPageUrl()}
          prefetch={false}
          className="block"
          title={`${promo.whopName} Promo Code - ${promo.promoText} (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`}
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-800" style={{ backgroundColor: 'var(--background-color)' }}>
              {!logoUrl || logoUrl.includes('Simplified Logo') || logoUrl.includes('placeholder') ? (
                <InitialsAvatar
                  name={title}
                  size="lg"
                  shape="square"
                  className="w-full h-full"
                />
              ) : (
                <WhopLogoSSR
                  src={logoUrl}
                  alt={`${promo.whopName} logo`}
                  width={64}
                  height={64}
                />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate" style={{ color: 'var(--text-color)' }}>{title}</h2>
              {previewText && (
                <p
                  className="text-base mt-1 truncate"
                  style={{ color: 'var(--accent-color)' }}
                  title={previewText}
                >
                  {previewText}
                </p>
              )}
              {priceBadge && (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-1 text-sm font-semibold"
                    style={{
                      backgroundColor:
                        priceBadge.toLowerCase() === 'free'
                          ? 'var(--success-color)'
                          : priceBadge.toLowerCase() === 'n/a'
                          ? 'var(--text-secondary)'
                          : 'var(--success-color)',
                      color: 'white',
                    }}
                  >
                    {priceBadge}
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
            prefetch={false}
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
