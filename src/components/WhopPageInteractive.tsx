'use client';

import { useRef } from 'react';
import WhopPageClient from './WhopPageClient';
import PromoStatsDisplay, { PromoStatsDisplayHandle } from './PromoStatsDisplay';

interface WhopPageInteractiveProps {
  whop: {
    id: string;
    name: string;
    slug: string;
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
}

// Standalone compact stats component
export function WhopPageCompactStats({ whopId, promoCodeId, slug }: { whopId: string; promoCodeId: string; slug?: string }) {
  return (
    <PromoStatsDisplay 
      whopId={whopId} 
      promoCodeId={promoCodeId}
      slug={slug}
      compact={true}
    />
  );
}

export default function WhopPageInteractive({ whop, firstPromo, promoCode, promoTitle }: WhopPageInteractiveProps) {
  return (
    <>
      {/* Interactive Button */}
      <WhopPageClient
        whop={whop}
        firstPromo={firstPromo}
        promoCode={promoCode}
        promoTitle={promoTitle}
        onTrackingComplete={() => {
          // Stats are now server-rendered via WhopMetaServer, no need to refresh client component
          console.log('🔄 Tracking complete - stats will update on next page load');
        }}
      />
    </>
  );
} 