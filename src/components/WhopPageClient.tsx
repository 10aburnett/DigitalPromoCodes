'use client';

import { useState, useEffect } from 'react';
import { useSocialProof, createSocialProofFromWhop } from '@/contexts/SocialProofContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface WhopPageClientProps {
  whop: {
    id: string;
    name: string;
    affiliateLink: string | null;
  };
  firstPromo: {
    id: string;
    code: string | null;
    title: string;
    type?: string;
    value?: string;
  } | null;
  promoCode: string | null;
  promoTitle: string;
  onTrackingComplete?: () => void; // Callback to refresh stats
}

export default function WhopPageClient({ whop, firstPromo, promoCode, promoTitle, onTrackingComplete }: WhopPageClientProps) {
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const { addNotification, isHydrated } = useSocialProof();
  const { t } = useLanguage();
  
  // Ensure hydration compatibility - delay client-only rendering
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Reset codeRevealed state when whop changes (e.g., language switch)
  useEffect(() => {
    setCodeRevealed(false);
  }, [whop.id, whop.name]); // Reset when whop ID or name changes

  const handleRevealCode = async () => {
    console.log("🔥 WhopPageClient: Reveal Code button clicked!", {
      whopName: whop.name,
      whopId: whop.id,
      firstPromoId: firstPromo?.id,
      hasWhopId: !!whop.id,
      hasFirstPromo: !!firstPromo,
      timestamp: new Date().toISOString()
    });

    // Open affiliate link
    if (whop?.affiliateLink) {
      window.open(whop.affiliateLink, '_blank', 'noopener,noreferrer');
    }
    
    // Reveal the code
    setCodeRevealed(true);
    
    // Track the action - now works even without promo code ID
    if (whop) {
      console.log("✅ WhopPageClient: Whop present, calling trackRevealCode");
      const success = await trackRevealCode(whop.id, firstPromo?.id || null);
      
      // Call the callback to refresh statistics if tracking was successful
      if (success && onTrackingComplete) {
        console.log("🔄 WhopPageClient: Calling onTrackingComplete to refresh stats");
        onTrackingComplete();
      }
    } else {
      console.warn("⚠️ WhopPageClient: Missing whop:", whop);
    }

    // Trigger social proof notification - only after mount and context is hydrated
    if (hasMounted && isHydrated) {
      const socialProofData = createSocialProofFromWhop({
        whopName: whop.name,
        promoCode: promoCode,
        promoValue: firstPromo?.value ? parseFloat(firstPromo.value) : undefined,
        promoType: firstPromo?.type,
        promoText: promoTitle,
      });
      addNotification(socialProofData);
    }
  };

  const trackRevealCode = async (whopId: string, promoCodeId: string | null): Promise<boolean> => {
    console.log("🔥 WhopPageClient: trackRevealCode called with:", {
      whopId,
      promoCodeId,
      whopName: whop.name,
      timestamp: new Date().toISOString()
    });

    try {
      const requestBody = {
        casinoId: whopId, // Using whopId as casinoId for compatibility
        bonusId: promoCodeId, // Using promoCodeId as bonusId for compatibility (can be null)
        actionType: 'code_copy', // Changed from 'button_click' to 'code_copy' for consistency with stats
      };

      console.log("📤 WhopPageClient: Sending tracking request:", requestBody);

      const response = await fetch('/api/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ WhopPageClient: Tracking successful:", result);
        return true;
      } else {
        const errorData = await response.text();
        console.error("❌ WhopPageClient: Tracking failed:", response.status, errorData);
        return false;
      }
    } catch (error) {
      console.error("❌ WhopPageClient: Error tracking reveal code:", error);
      return false;
    }
  };

  // Show initial button state during SSR and until mounted to prevent hydration mismatch
  if (!hasMounted) {
    return (
      <div className="w-full">
        <button 
          className="w-full font-bold py-3 px-4 rounded-lg text-center transition-all duration-200 hover:opacity-90 hover:scale-[1.02] transform-gpu"
          style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
          disabled
        >
          {t('whop.revealCode')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!codeRevealed ? (
        <button 
          onClick={handleRevealCode}
          className="w-full font-bold py-3 px-4 rounded-lg text-center transition-all duration-200 hover:opacity-90 hover:scale-[1.02] transform-gpu"
          style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
        >
          {t('whop.revealCode')}
        </button>
      ) : (
        <div className="w-full border-2 font-bold py-3 px-4 rounded-lg text-center transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--accent-color)', color: 'var(--text-color)' }}>
          {promoCode ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>{promoCode}</span>
          ) : whop.name === 'Josh Exclusive VIP Access' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>JOSH</span>
          ) : whop.name === 'Momentum Monthly' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-1A92969C</span>
          ) : whop.name === 'Larry\'s Lounge Premium' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-BF9EF1CC</span>
          ) : whop.name === 'Dodgy\'s Dungeon' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-565022F7</span>
          ) : whop.name === 'Trade With Insight - Pro' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-624C9EA4</span>
          ) : whop.name === 'ParlayScience Discord Access' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-C0047AFA</span>
          ) : whop.name === 'Scarface Trades Premium' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-01FE6235</span>
          ) : whop.name === 'The Haven' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-45EF5D24</span>
          ) : whop.name === 'PropFellas VIP' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-B83DC955</span>
          ) : whop.name === 'Owls Full Access' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-7136BFC8</span>
          ) : whop.name === 'Stellar AIO' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-1A6008FA</span>
          ) : whop.name === 'Goat Ecom Growth' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-1B868367</span>
          ) : whop.name === 'Indicators & VIP | LIFETIME' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-7DBFEB18</span>
          ) : whop.name === 'Supercar Income' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-5E906FAB</span>
          ) : whop.name === 'GOAT Sports Bets Membership' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-3352BB19</span>
          ) : whop.name === 'Best Of Both Worlds' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-336B4ACD</span>
          ) : whop.name === 'Moementum University' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-23AB3618</span>
          ) : whop.name === 'ZWM Lifetime Access' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-4E6D572F</span>
          ) : whop.name === 'Ayecon Academy' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-022D1F18</span>
          ) : whop.name === 'The BFI Traders University' ? (
            <span className="text-lg" style={{ color: 'var(--accent-color)' }}>PROMO-58B279FF</span>
          ) : (
            <span className="text-lg" style={{ color: 'var(--success-color)' }}>{t('whop.noCode')}</span>
          )}
        </div>
      )}
    </div>
  );
} 