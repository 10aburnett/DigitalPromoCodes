'use client';

import { useState, useEffect } from 'react';
import StickyCallToAction from '@/components/StickyCallToAction';
import Image from 'next/image';

interface CasinoData {
  id: string;
  name: string;
  bonusTitle: string;
  bonusCode: string | null;
  bonusId: string | undefined;
  affiliateLink: string | null;
  logo: string | null;
}

interface ClientStickyWrapperProps {
  casinoData: CasinoData;
}

export default function ClientStickyWrapper({ casinoData }: ClientStickyWrapperProps) {
  // Explicitly set to false to ensure it starts hidden
  const [isVisible, setIsVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    // Function to check scroll position and update visibility
    const handleScroll = () => {
      // Get current scroll position
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Calculate how close to the bottom we are
      const distanceFromBottom = documentHeight - (scrollPosition + windowHeight);
      const isAtBottom = distanceFromBottom < 100; // Within 100px of the bottom
      
      // Show after any scroll occurs, but hide at the top or bottom
      if (scrollPosition > 0 && !isAtBottom && !isVisible) {
        setIsVisible(true);
        setHasScrolled(true);
      } else if ((scrollPosition === 0 || isAtBottom) && isVisible) {
        setIsVisible(false);
        setHasScrolled(false);
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);
    
    // Add resize event listener to recalculate when window size changes
    window.addEventListener('resize', handleScroll);
    
    // Initial check (should be hidden at start)
    handleScroll();
    
    // Clean up the event listeners when the component unmounts
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isVisible]);

  // If not visible, render nothing
  if (!isVisible) return null;

  // Render the sticky CTA when visible
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 border-t shadow-lg z-50 transform transition-transform duration-300 ease-in-out py-3 pb-5 md:py-4"
      style={{ 
        backgroundColor: 'var(--background-secondary)', 
        borderColor: 'var(--border-color)' 
      }}
    >
      <div className="max-w-4xl mx-auto px-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center mb-3 sm:mb-0">
          {casinoData.logo && (
            <div 
              className="relative w-10 h-10 md:w-14 md:h-14 rounded-md overflow-hidden mr-3 flex-shrink-0 bg-gray-800"
              style={{ backgroundColor: 'var(--background-color)' }}
            >
              <Image
                src={casinoData.logo}
                alt={`${casinoData.name} logo`}
                width={56}
                height={56}
                className="w-full h-full object-contain"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            </div>
          )}
          <div className="flex flex-col pr-3">
            <p className="text-lg md:text-xl font-medium truncate" style={{ color: 'var(--text-color)' }}>{casinoData.name}</p>
            <p className="text-base md:text-lg font-medium truncate" style={{ color: 'var(--accent-color)' }}>{casinoData.bonusTitle}</p>
          </div>
        </div>
        <div className="w-full sm:w-auto flex justify-center">
          <StickyCallToAction
            whopName={casinoData.name}
            whopId={casinoData.id}
            promoCodeId={casinoData.bonusId}
            promoTitle={casinoData.bonusTitle}
            promoCode={casinoData.bonusCode}
            affiliateLink={casinoData.affiliateLink}
            logo={casinoData.logo}
          />
        </div>
      </div>
    </div>
  );
} 