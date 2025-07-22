'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SocialProofData } from '@/components/SocialProofPopup';

interface SocialProofContextType {
  notifications: SocialProofData[];
  addNotification: (data: Omit<SocialProofData, 'id'>) => void;
  removeNotification: (id: string) => void;
  isHydrated: boolean;
}

const SocialProofContext = createContext<SocialProofContextType | undefined>(undefined);

// Array of realistic names for the social proof
const REALISTIC_NAMES = [
  'Sarah', 'Jake', 'Lily', 'Emma', 'Alex', 'Jessica', 'Chris', 'Ashley', 
  'Ryan', 'Lauren', 'Brandon', 'Taylor', 'Jordan', 'Madison', 'Tyler',
  'Kayla', 'Josh', 'Megan', 'Derek', 'Nicole', 'Kevin', 'Amanda', 'Jason',
  'Rachel', 'Daniel', 'Stephanie', 'Matthew', 'Jennifer', 'David', 'Michelle',
  'Andrew', 'Kimberly', 'James', 'Amy', 'Michael', 'Lisa', 'John', 'Angela',
  'Robert', 'Heather', 'William', 'Elizabeth', 'Richard', 'Maria', 'Joseph',
  'Susan', 'Thomas', 'Karen', 'Charles', 'Nancy', 'Christopher', 'Betty',
  'Mark', 'Helen', 'Paul', 'Sandra', 'Anthony', 'Donna', 'Steven', 'Carol'
];

// Global counter for unique IDs (prevents hydration mismatches)
let idCounter = 0;

// Function to get a random realistic name (only after hydration)
const getRandomName = (): string => {
  const randomIndex = Math.floor(Math.random() * REALISTIC_NAMES.length);
  return REALISTIC_NAMES[randomIndex];
};

// Function to format course/whop name with proper capitalization
const formatWhopName = (name: string): string => {
  if (!name) return name;
  
  // Split by common separators and capitalize each word
  return name
    .split(/[\s-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Function to generate realistic savings amount in £ (only after hydration)
const generateSavingsAmount = (promoValue?: number, promoType?: string): string => {
  // If we have a promo value, use it
  if (promoValue && promoValue > 0) {
    if (promoType?.toLowerCase().includes('percent') || promoType?.toLowerCase().includes('%')) {
      // For percentage discounts, calculate a realistic pound amount
      const baseAmount = Math.floor(Math.random() * 200) + 50; // £50-£250 base
      const discount = Math.floor(baseAmount * (promoValue / 100));
      return `£${discount}`;
    } else {
      // For fixed amount discounts
      return `£${promoValue}`;
    }
  }
  
  // Generate random savings amount between £5-£50
  const amounts = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const randomAmount = amounts[Math.floor(Math.random() * amounts.length)];
  return `£${randomAmount}`;
};

// Function to check if a promo code is valid/real
const isValidPromoCode = (code?: string | null): boolean => {
  if (!code) return false;
  
  // Filter out placeholder/fake codes
  const invalidCodes = [
    'EXCLUSIVE', 'SPECIAL', 'DISCOUNT', 'SAVE', 'DEAL', 'OFFER',
    'PROMO', 'CODE', 'BONUS', 'FREE', 'LIMITED', 'VIP', 'PREMIUM'
  ];
  
  const upperCode = code.toUpperCase();
  return !invalidCodes.includes(upperCode) && code.length > 2;
};

export function SocialProofProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<SocialProofData[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Wait for hydration before allowing random values
  useEffect(() => {
    setIsHydrated(true);
    // Reset counter after hydration to ensure client-side consistency
    idCounter = 0;
  }, []);

  const addNotification = useCallback((data: Omit<SocialProofData, 'id'>) => {
    // Only add notifications after hydration to prevent server/client mismatch
    if (!isHydrated) {
      return;
    }

    // Use counter-based ID to prevent hydration mismatches
    const notification: SocialProofData = {
      ...data,
      id: `notification-${++idCounter}`,
      name: data.name || getRandomName(),
      amount: data.amount || generateSavingsAmount(),
      whopName: formatWhopName(data.whopName),
      // NEVER show actual promo codes for revenue protection
      code: '',
    };

    setNotifications(prev => {
      // Keep only the last 3 notifications to prevent memory issues
      const updated = [...prev, notification];
      return updated.slice(-3);
    });
  }, [isHydrated]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  return (
    <SocialProofContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      isHydrated
    }}>
      {children}
    </SocialProofContext.Provider>
  );
}

export function useSocialProof() {
  const context = useContext(SocialProofContext);
  if (context === undefined) {
    throw new Error('useSocialProof must be used within a SocialProofProvider');
  }
  return context;
}

// Helper function to create social proof notification data from whop data
// This should only be called after hydration
export function createSocialProofFromWhop(whopData: {
  whopName: string;
  promoCode?: string | null;
  promoValue?: number;
  promoType?: string;
  promoText?: string;
}): Omit<SocialProofData, 'id'> {
  return {
    name: '', // Will be set by addNotification after hydration
    amount: '', // Will be set by addNotification after hydration
    code: whopData.promoCode || '', // Pass the actual code or empty string
    whopName: whopData.whopName,
  };
} 