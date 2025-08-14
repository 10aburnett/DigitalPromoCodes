'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
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

export function LanguageProvider({ children, locale }: LanguageProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  
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

  // Track hydration state and load localStorage preference
  useEffect(() => {
    setIsHydrated(true);
    
    // After hydration, check localStorage and URL for language preference
    const pathSegments = pathname.split('/').filter(Boolean);
    let detectedLanguage = language; // Start with current language
    
    // First, check URL for language
    if (pathSegments.length > 0 && languageKeys.includes(pathSegments[0] as Language) && pathSegments[0] !== 'en') {
      detectedLanguage = pathSegments[0] as Language;
    } else if (pathSegments.length === 0 || !pathSegments.some(segment => languageKeys.includes(segment as Language) && segment !== 'en')) {
      // For English paths, check localStorage
      const savedLanguage = localStorage.getItem('selectedLanguage');
      if (savedLanguage && languageKeys.includes(savedLanguage as Language)) {
        detectedLanguage = savedLanguage as Language;
      } else {
        detectedLanguage = defaultLanguage;
      }
    }
    
    // Update language if it's different from current
    if (detectedLanguage !== language) {
      setLanguageState(detectedLanguage);
    }
    
    // Always save current language to localStorage
    localStorage.setItem('selectedLanguage', detectedLanguage);
  }, []);

  // Extract language from URL path after initial hydration
  useEffect(() => {
    if (!isHydrated) return;

    const pathSegments = pathname.split('/').filter(Boolean);
    
    // Check if the first segment is a language code (excluding 'en')
    if (pathSegments.length > 0 && languageKeys.includes(pathSegments[0] as Language) && pathSegments[0] !== 'en') {
      const urlLanguage = pathSegments[0] as Language;
      // Only update if different from current language to prevent loops
      if (urlLanguage !== language) {
        setLanguageState(urlLanguage);
        localStorage.setItem('selectedLanguage', urlLanguage);
      }
    } else {
      // For English paths, check if we should update to English
      if (language !== defaultLanguage && !pathSegments.some(segment => languageKeys.includes(segment as Language) && segment !== 'en')) {
        setLanguageState(defaultLanguage);
        localStorage.setItem('selectedLanguage', defaultLanguage);
      }
    }
  }, [pathname, isHydrated, language]);

  // Change language and update URL
  const setLanguage = (newLanguage: Language) => {
    const pathSegments = pathname.split('/').filter(Boolean);
    let newPath = pathname;
    
    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedLanguage', newLanguage);
    }
    
    // Check if we're currently on a whop detail page
    const isWhopDetailPage = () => {
      // English whop page: /whop/[slug]
      if (pathSegments.length === 2 && pathSegments[0] === 'whop') {
        return { type: 'english-whop', slug: pathSegments[1] };
      }
      // Localized whop page: /[locale]/[slug] where locale is not 'whop'
      // BUT exclude privacy and terms pages
      if (pathSegments.length === 2 && 
          languageKeys.includes(pathSegments[0] as Language) && 
          pathSegments[1] !== 'privacy' && 
          pathSegments[1] !== 'terms' &&
          pathSegments[1] !== 'contact') {
        return { type: 'localized-whop', locale: pathSegments[0], slug: pathSegments[1] };
      }
      return null;
    };

    // Check if we're on a legal page (privacy/terms)
    const isLegalPage = () => {
      // English legal pages: /privacy, /terms
      if (pathSegments.length === 1 && (pathSegments[0] === 'privacy' || pathSegments[0] === 'terms')) {
        return { type: 'english-legal', page: pathSegments[0] };
      }
      // Localized legal pages: /[locale]/privacy, /[locale]/terms
      if (pathSegments.length === 2 && 
          languageKeys.includes(pathSegments[0] as Language) && 
          (pathSegments[1] === 'privacy' || pathSegments[1] === 'terms')) {
        return { type: 'localized-legal', locale: pathSegments[0], page: pathSegments[1] };
      }
      return null;
    };

    // Check if we're on a contact page
    const isContactPage = () => {
      // English contact page: /contact
      if (pathSegments.length === 1 && pathSegments[0] === 'contact') {
        return { type: 'english-contact', page: pathSegments[0] };
      }
      // Localized contact page: /[locale]/contact
      if (pathSegments.length === 2 && 
          languageKeys.includes(pathSegments[0] as Language) && 
          pathSegments[1] === 'contact') {
        return { type: 'localized-contact', locale: pathSegments[0], page: pathSegments[1] };
      }
      return null;
    };

    const whopPageInfo = isWhopDetailPage();
    const legalPageInfo = isLegalPage();
    const contactPageInfo = isContactPage();

    if (whopPageInfo) {
      // Handle whop detail page language switching
      if (newLanguage === 'en') {
        // Switching to English: use /whop/[slug] format
        newPath = `/whop/${whopPageInfo.slug}`;
      } else {
        // Switching to other language: use /[locale]/[slug] format
        newPath = `/${newLanguage}/${whopPageInfo.slug}`;
      }
    } else if (legalPageInfo) {
      // Handle legal page language switching
      if (newLanguage === 'en') {
        // Switching to English: use /[page] format
        newPath = `/${legalPageInfo.page}`;
      } else {
        // Switching to other language: use /[locale]/[page] format
        newPath = `/${newLanguage}/${legalPageInfo.page}`;
      }
    } else if (contactPageInfo) {
      // Handle contact page language switching
      if (newLanguage === 'en') {
        // Switching to English: use /contact format
        newPath = `/contact`;
      } else {
        // Switching to other language: use /[locale]/contact format
        newPath = `/${newLanguage}/contact`;
      }
    } else {
      // Handle regular page language switching
      if (newLanguage === 'en') {
        // For English, redirect to root level (remove language prefix)
        if (pathSegments.length > 0 && languageKeys.includes(pathSegments[0] as Language)) {
          // Remove the language prefix and keep the rest
          const remainingSegments = pathSegments.slice(1);
          newPath = remainingSegments.length > 0 ? `/${remainingSegments.join('/')}` : '/';
        }
        // If already at root level or no language prefix, keep the same path
      } else {
        // For other languages, use direct language prefix
        if (pathSegments.length > 0 && languageKeys.includes(pathSegments[0] as Language)) {
          // Replace existing language
          pathSegments[0] = newLanguage;
          newPath = `/${pathSegments.join('/')}`;
        } else {
          // Add language prefix to current path
          if (pathname === '/') {
            newPath = `/${newLanguage}`;
          } else {
            newPath = `/${newLanguage}${pathname}`;
          }
        }
      }
    }
    
    // Ensure we always have a valid path
    if (!newPath || newPath === '') {
      newPath = '/';
    }
    
    // Ensure path starts with / for consistent routing
    if (!newPath.startsWith('/')) {
      newPath = '/' + newPath;
    }
    
    // Update the language state first
    setLanguageState(newLanguage);
    
    // Debug logging for troubleshooting
    console.log('🌐 Language switch:', { 
      from: language, 
      to: newLanguage, 
      currentPath: pathname, 
      newPath: newPath,
      environment: process.env.NODE_ENV 
    });
    
    // Force a hard navigation for better production compatibility
    // This ensures the page fully reloads with the new language
    if (typeof window !== 'undefined') {
      window.location.href = newPath;
    } else {
      // Fallback for SSR
      router.replace(newPath);
    }
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