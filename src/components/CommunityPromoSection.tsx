'use client'
import React, { useState, useEffect, useRef } from 'react'
import WhopPageClient from './WhopPageClient'
import PromoStatsDisplay from './PromoStatsDisplay'

interface PromoCode {
  id: string
  title: string
  description: string
  code: string | null
  type: string
  value: string
  createdAt: Date
}

interface CommunityPromoSectionProps {
  whop: {
    id: string
    name: string
    affiliateLink: string | null
  }
  promoCodes: PromoCode[]
}

export default function CommunityPromoSection({ whop, promoCodes }: CommunityPromoSectionProps) {
  // Client-side debug to see what data reaches the component
  React.useEffect(() => {
    console.error('🔍 CommunityPromoSection received data:', {
      whopId: whop.id,
      whopName: whop.name,
      totalPromoCodes: promoCodes.length,
      promoCodeDetails: promoCodes.map(p => ({
        id: p.id,
        title: p.title,
        code: p.code,
        isCommunity: p.id.startsWith('community_')
      }))
    });
  }, [whop.id, promoCodes]);

  // Separate community codes from original codes
  const communityPromoCodes = promoCodes.filter(code => code.id.startsWith('community_'))
  const originalPromoCodes = promoCodes.filter(code => !code.id.startsWith('community_'))


  if (communityPromoCodes.length === 0 && originalPromoCodes.length === 0) {
    return null // No promo codes to display
  }

  // Handle tracking completion to refresh stats
  const handleTrackingComplete = () => {
    // Trigger refresh for all compact stats on the page
    const compactStatsElements = document.querySelectorAll('[data-compact-stats]');
    compactStatsElements.forEach((element) => {
      const event = new CustomEvent('refreshStats');
      element.dispatchEvent(event);
    });
  };

  return (
    <div className="space-y-4">
      {/* Community Submitted Promo Codes */}
      {communityPromoCodes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>
              Community Codes
            </h3>
            <span className="px-2 py-1 rounded text-xs font-medium" 
                  style={{ 
                    backgroundColor: 'var(--accent-color)', 
                    color: 'white' 
                  }}>
              NEW
            </span>
          </div>
          
          {communityPromoCodes.map((promo, index) => (
            <div key={promo.id} className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium px-2 py-1 rounded" 
                      style={{ 
                        backgroundColor: 'var(--accent-color)', 
                        color: 'white' 
                      }}>
                  #{index + 1}
                </span>
              </div>
              <WhopPageClient
                whop={whop}
                firstPromo={promo}
                promoCode={promo.code}
                promoTitle={promo.title}
                onTrackingComplete={handleTrackingComplete}
              />
              {/* Stats display */}
              <div className="mt-2">
                <PromoStatsDisplay 
                  whopId={whop.id}
                  promoCodeId={promo.id}
                  compact={false}
                />
              </div>
            </div>
          ))}

          {/* Simple separator */}
          {originalPromoCodes.length > 0 && (
            <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>
                  Original Codes
                </h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Original Promo Codes */}
      {originalPromoCodes.length > 0 && (
        <div className="space-y-3">          
          {originalPromoCodes.map((promo, index) => (
            <div key={promo.id} className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium px-2 py-1 rounded" 
                      style={{ 
                        backgroundColor: 'var(--background-color)', 
                        color: 'var(--text-color)',
                        border: '1px solid var(--border-color)'
                      }}>
                  #{communityPromoCodes.length + index + 1}
                </span>
              </div>
              <WhopPageClient
                whop={whop}
                firstPromo={promo}
                promoCode={promo.code}
                promoTitle={promo.title}
                onTrackingComplete={handleTrackingComplete}
              />
              {/* Stats display */}
              <div className="mt-2">
                <PromoStatsDisplay 
                  whopId={whop.id}
                  promoCodeId={promo.id}
                  compact={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}