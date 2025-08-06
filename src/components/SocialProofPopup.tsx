'use client';

import React, { useState, useEffect } from 'react';
import { useSocialProof } from '@/contexts/SocialProofContext';

export interface SocialProofData {
  id: string;
  name: string;
  amount: string;
  code: string;
  whopName: string;
}

interface SocialProofPopupProps {
  data: SocialProofData;
  onComplete: () => void;
}

function SocialProofPopupItem({ data, onComplete }: SocialProofPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start entrance animation
    const enterTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    // Start exit animation after 5 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 5000);

    // Complete removal after exit animation
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`
        fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 
        max-w-xs sm:max-w-sm w-auto
        bg-white dark:bg-gray-800 
        border border-gray-200 dark:border-gray-700
        rounded-lg shadow-lg p-3 sm:p-4
        transition-all duration-500 ease-out
        ${isVisible && !isExiting 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-4 scale-95'
        }
      `}
      style={{
        backgroundColor: 'var(--background-secondary)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-color)',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Party emoji for visual interest */}
        <div className="text-lg sm:text-xl flex-shrink-0">🎉</div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Checkmark icon */}
            <svg 
              className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" 
              style={{ color: 'var(--success-color)' }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
            <span className="font-semibold text-xs sm:text-sm" style={{ color: 'var(--success-color)' }}>
              Just saved!
            </span>
          </div>
          
          <p className="text-xs sm:text-sm leading-relaxed">
            Someone just saved money on <span className="font-medium">{data.whopName}</span> by using one of our promo codes!
          </p>
        </div>
      </div>
    </div>
  );
}

interface SocialProofPopupManagerProps {
  notifications: SocialProofData[];
  onRemove: (id: string) => void;
}

export default function SocialProofPopupManager({ notifications, onRemove }: SocialProofPopupManagerProps) {
  const { isHydrated } = useSocialProof();
  
  // Don't render anything until hydration is complete to prevent mismatches
  if (!isHydrated) {
    return null;
  }

  // Only show the most recent notification to avoid overlap
  const currentNotification = notifications[notifications.length - 1];

  if (!currentNotification) {
    return null;
  }

  return (
    <SocialProofPopupItem
      key={currentNotification.id}
      data={currentNotification}
      onComplete={() => onRemove(currentNotification.id)}
    />
  );
} 