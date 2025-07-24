'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface OfferButtonProps {
  affiliateLink: string | null;
  whopId: string;
  promoCodeId: string | undefined;
  size?: 'default' | 'small' | 'large';
  isSticky?: boolean;
}

export default function OfferButton({ 
  affiliateLink, 
  whopId, 
  promoCodeId,
  size = 'default',
  isSticky = false
}: OfferButtonProps) {
  const { t } = useLanguage();

  const trackOfferClick = async () => {
    if (!whopId) return;
    
    try {
      const trackingData = JSON.stringify({
        casinoId: whopId, // Using whopId as casinoId for API compatibility
        bonusId: promoCodeId || null, // Using promoCodeId as bonusId for API compatibility (can be null)
        actionType: 'offer_click',
      });
      
      // Use sendBeacon API if available for better reliability when page unloads
      if (navigator.sendBeacon) {
        const blob = new Blob([trackingData], { type: 'application/json' });
        const success = navigator.sendBeacon('/api/tracking', blob);
        
        if (success) return;
      }
      
      // Fall back to fetch if sendBeacon is not available or failed
      await fetch('/api/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: trackingData,
      });
    } catch (error) {
      console.error("Error tracking offer click:", error);
    }
  };

  const handleClick = () => {
    if (whopId) {
      trackOfferClick();
    }
  };

  let buttonClasses = "";
  
  if (size === 'small') {
    buttonClasses = "bg-[#68D08B] text-[#343541] font-bold px-4 py-2 text-sm md:text-base rounded-lg hover:bg-[#5abc7a] transition-all duration-200 text-center whitespace-nowrap";
  } else if (isSticky) {
    buttonClasses = "bg-[#68D08B] text-[#343541] font-bold px-5 py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-[#5abc7a] transition-all duration-200 text-center text-sm md:text-base whitespace-nowrap h-[38px] md:h-[44px] flex items-center justify-center w-full md:w-auto";
  } else if (size === 'large') {
    buttonClasses = "bg-[#68D08B] text-[#343541] font-bold px-6 py-3 md:px-8 md:py-3.5 rounded-lg hover:bg-[#5abc7a] transition-all duration-200 text-center text-base md:text-xl whitespace-nowrap";
  } else {
    buttonClasses = "bg-[#68D08B] text-[#343541] font-bold px-6 py-3 md:px-8 md:py-3.5 rounded-lg hover:bg-[#5abc7a] transition-all duration-200 text-center text-base md:text-xl whitespace-nowrap";
  }

  return (
    <a
      href={affiliateLink || '#'}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={buttonClasses}
      onClick={handleClick}
    >
      {t('whop.getPromo')}
    </a>
  );
} 