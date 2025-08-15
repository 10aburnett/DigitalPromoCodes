'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Language, defaultLanguage, getTranslation, languageKeys } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  isHydrated: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  locale?: string; // Server-side locale prop
}

const LOCALE_RE = /^\/(es|nl|fr|de|it|pt|zh)(?=\/|$)/;

export function LanguageProvider({ children, locale }: LanguageProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const switching = useRef(false);
  
  // Initialize language - server-safe approach
  const getInitialLanguage = (): Language => {
    // Always use server-side locale if provided, otherwise default
    if (locale && languageKeys.includes(locale as Language)) {
      return locale as Language;
    }
    return defaultLanguage;
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage());
  const [isHydrated, setIsHydrated] = useState(false);

  // Simple hydration - no automatic redirects at all
  useEffect(() => {
    setIsHydrated(true);
    // Remove ALL auto-detection and auto-redirect logic
    // Language is controlled purely by the server-side locale prop
  }, []); // Only run once on mount

  // Simple, loop-free language switching
  const setLanguage = (newLanguage: Language) => {
    if (switching.current) return;
    switching.current = true;

    const clean = pathname.replace(LOCALE_RE, ""); // remove any current prefix
    const target = newLanguage === "en" ? clean || "/" : `/${newLanguage}${clean}`;

    // Only navigate if the target actually differs
    if (target !== pathname) {
      setLanguageState(newLanguage);
      router.push(target);
    }
    
    // Small timeout to survive double-invoke in StrictMode
    setTimeout(() => { switching.current = false; }, 300);
  };

  // Simple and reliable translation function
  const t = (key: string): string => {
    return getTranslation(key, language);
  };

  const value = {
    language,
    setLanguage,
    t,
    isHydrated
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
} 