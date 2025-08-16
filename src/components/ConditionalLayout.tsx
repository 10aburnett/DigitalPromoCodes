'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SocialProofProvider, useSocialProof } from '@/contexts/SocialProofContext';
import SocialProofPopupManager from './SocialProofPopup';
import GeneralPromoSubmissionButton from './GeneralPromoSubmissionButton';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface ConditionalLayoutProps {
  children: React.ReactNode;
  faviconUrl: string;
}

function LayoutContent({ children, faviconUrl }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const { notifications, removeNotification } = useSocialProof();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFooterOpen, setIsMobileFooterOpen] = useState(false);
  const isMobile = useIsMobile();

  const currentYear = new Date().getFullYear();

  // Helper function to get localized paths
  const getLocalizedPath = (path: string) => {
    if (language === 'en') {
      return path; // English uses root paths
    }
    return `/${language}${path}`; // Other languages use language prefix
  };

  // Handler for mobile Submit Code button
  const handleMobileSubmitCode = () => {
    // Always close the sheet first
    setIsMobileMenuOpen(false);
    setIsMobileFooterOpen(false);

    // Mobile: navigate to the dedicated page so it always works
    if (isMobile) {
      router.push("/submit-code");
      return;
    }

    // Desktop: fallback to page navigation (modal behavior handled elsewhere)
    router.push("/submit-code");
  };

  // Check if we're in the admin panel - ONLY exclude admin routes from header/footer
  const isAdminRoute = pathname.startsWith('/admin');

  // For admin routes, only render the children without header/footer
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // For ALL other pages (including whop pages), show the full layout with header and footer
  return (
    <>
      <header className="fixed top-0 w-full transition-theme z-50 pb-0 md:pb-2 lg:pb-1" style={{ backgroundColor: 'var(--background-color)', borderBottom: '2px solid var(--border-color)' }}>
        <div className="container mx-auto px-2 sm:px-4 h-20 md:h-20 lg:h-[72px] xl:h-[72px] flex items-center justify-start md:justify-between gap-2">
          <div className="flex items-center space-x-1 md:space-x-6">
            <Link href={getLocalizedPath('/')} className="flex items-center transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80">
              <div className="text-xl md:text-2xl font-bold translate-x-[6px] md:translate-x-0" style={{ color: 'var(--accent-color)' }}>
                WHP<span style={{ color: 'var(--text-color)' }}>CODES</span>
              </div>
            </Link>
            
            {/* Separator line - hidden on mobile */}
            <div className="hidden md:block h-8 w-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
            
            {/* WHPBLOG - hidden on mobile */}
            <Link href={getLocalizedPath('/blog')} className="hidden md:flex items-center transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80">
              <div className="text-2xl font-bold">
                <span style={{ color: 'var(--accent-color)' }}>WHP</span><span style={{ color: 'var(--text-color)' }}>BLOG</span>
              </div>
            </Link>
          </div>
          
          {/* Navigation and Controls */}
          <div className="flex items-center">
            {/* Mobile: Language selector, theme toggle, and hamburger menu */}
            <div className="flex md:hidden items-center gap-2 pl-2 ml-16">
              <LanguageSelector />
              <ThemeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 transition-all duration-200 hover:opacity-80"
                style={{ color: 'var(--text-color)' }}
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            {/* Desktop: Full navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <nav className="flex items-center space-x-6">
                <Link href={getLocalizedPath('/')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                  {t('nav.home')}
                </Link>
                <GeneralPromoSubmissionButton 
                  className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80 cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Submit Code
                </GeneralPromoSubmissionButton>
                <Link href="/subscribe" className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                  Subscribe
                </Link>
                <Link href={getLocalizedPath('/about')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                  {t('nav.about')}
                </Link>
                <Link href={getLocalizedPath('/contact')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                  {t('nav.contact')}
                </Link>
              </nav>
              <div className="flex items-center space-x-3">
                <LanguageSelector />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Top Sheet */}
        {isMobileMenuOpen && (
          <>
            {/* scrim */}
            <button
              aria-label="Close menu overlay"
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            {/* sheet */}
            <div className="fixed inset-x-0 top-0 z-50 rounded-b-2xl border-b p-4 shadow-lg transition-theme" style={{ 
              backgroundColor: 'var(--background-color)', 
              borderColor: 'var(--border-color)' 
            }}>
              <div className="mx-auto h-1.5 w-10 rounded-full mb-4" style={{ backgroundColor: 'var(--border-color)' }}></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <Link 
                  href={getLocalizedPath('/blog')} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  <span className="font-bold" style={{ color: 'var(--accent-color)' }}>WHP</span><span className="font-bold" style={{ color: 'var(--text-color)' }}>BLOG</span>
                </Link>
                <Link 
                  href={getLocalizedPath('/')} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('nav.home')}
                </Link>
                <button
                  type="button"
                  onClick={handleMobileSubmitCode}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  Submit Code
                </button>
                <Link 
                  href="/subscribe" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  Subscribe
                </Link>
                <Link 
                  href={getLocalizedPath('/about')} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('nav.about')}
                </Link>
                <Link 
                  href={getLocalizedPath('/contact')} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('nav.contact')}
                </Link>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-4 w-full rounded-xl border px-3 py-2 text-sm transition-all duration-200"
                aria-label="Close menu"
                style={{ 
                  borderColor: 'var(--border-color)', 
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-color)'
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </header>

      <div className="transition-theme pt-20 md:pt-20 lg:pt-[76px] xl:pt-[76px]" style={{ backgroundColor: 'var(--background-color)' }}>
        {children}
      </div>

      <footer className="transition-theme border-t -mt-8 md:mt-8 pt-1 md:pt-8" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
        {/* DESKTOP FOOTER (unchanged) */}
        <div className="hidden md:block pb-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6 sm:mb-0">
                <Link href={getLocalizedPath('/')} className="transition-all duration-200 hover:translate-y-[-1px] font-bold text-center sm:text-left hover:opacity-80">
                  <span style={{ color: 'var(--accent-color)' }}>WHP</span><span style={{ color: 'var(--text-color)' }}>CODES</span>
                </Link>
                <div className="flex items-center justify-center sm:justify-start gap-6 text-sm mt-4 sm:mt-0">
                  <div className="h-4 w-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
                  <Link href={getLocalizedPath('/blog')} className="font-bold transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ 
                    fontSize: '0.875rem'
                  }}>
                    <span style={{ color: 'var(--accent-color)' }}>WHP</span><span style={{ color: 'var(--text-color)' }}>BLOG</span>
                  </Link>
                  <GeneralPromoSubmissionButton 
                    className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80 cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Submit Code
                  </GeneralPromoSubmissionButton>
                  <Link href="/subscribe" className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Subscribe
                  </Link>
                  <Link href={getLocalizedPath('/about')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    {t('nav.about')}
                  </Link>
                  <Link href={getLocalizedPath('/privacy')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    {t('footer.privacy')}
                  </Link>
                  <Link href={getLocalizedPath('/terms')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    {t('footer.terms')}
                  </Link>
                  <Link href={getLocalizedPath('/contact')} className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    {t('nav.contact')}
                  </Link>
                  <Link href="/unsubscribe" className="transition-all duration-200 hover:translate-y-[-1px] hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Unsubscribe
                  </Link>
                </div>
              </div>
              <div className="text-xs text-center sm:text-right opacity-70" style={{ color: 'var(--text-muted)' }}>
                © {currentYear} WHPCodes. {t('footer.rights')}
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE FOOTER */}
        <div className="md:hidden py-1 md:py-8">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex flex-col items-center gap-3">
              {/* logo */}
              <Link
                href={getLocalizedPath('/')}
                className="select-none text-xl font-extrabold tracking-tight"
                aria-label="WHP Codes home"
              >
                <span style={{ color: 'var(--accent-color)' }}>WHP</span>
                <span style={{ color: 'var(--text-color)' }}> CODES</span>
              </Link>

              {/* hamburger button */}
              <button
                type="button"
                onClick={() => setIsMobileFooterOpen(!isMobileFooterOpen)}
                aria-label="Open footer menu"
                className="mt-1 rounded-xl border p-2 shadow-sm active:scale-[0.98] transition-all duration-200"
                style={{ 
                  borderColor: 'var(--border-color)', 
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-color)'
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* copyright */}
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                © {currentYear} WHPCodes. {t('footer.rights')}
              </p>
            </div>
          </div>
        </div>

        {/* MOBILE bottom sheet */}
        {isMobileFooterOpen && (
          <>
            {/* scrim */}
            <button
              aria-label="Close menu overlay"
              onClick={() => setIsMobileFooterOpen(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            {/* sheet */}
            <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t p-4 shadow-lg transition-theme" style={{ 
              backgroundColor: 'var(--background-color)', 
              borderColor: 'var(--border-color)' 
            }}>
              <div className="mx-auto h-1.5 w-10 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <Link
                  href={getLocalizedPath('/blog')}
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  <span className="font-bold" style={{ color: 'var(--accent-color)' }}>WHP</span><span className="font-bold" style={{ color: 'var(--text-color)' }}>BLOG</span>
                </Link>
                <button
                  type="button"
                  onClick={handleMobileSubmitCode}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  Submit Code
                </button>
                <Link
                  href="/subscribe"
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  Subscribe
                </Link>
                <Link
                  href={getLocalizedPath('/about')}
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('nav.about')}
                </Link>
                <Link
                  href={getLocalizedPath('/privacy')}
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('footer.privacy')}
                </Link>
                <Link
                  href={getLocalizedPath('/terms')}
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('footer.terms')}
                </Link>
                <Link
                  href={getLocalizedPath('/contact')}
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  {t('nav.contact')}
                </Link>
                <Link
                  href="/unsubscribe"
                  onClick={() => setIsMobileFooterOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                >
                  Unsubscribe
                </Link>
              </div>
              <button
                onClick={() => setIsMobileFooterOpen(false)}
                className="mt-4 w-full rounded-xl border px-3 py-2 text-sm transition-all duration-200"
                aria-label="Close menu"
                style={{ 
                  borderColor: 'var(--border-color)', 
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-color)'
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </footer>

      {/* Social Proof Popup Manager */}
      <SocialProofPopupManager 
        notifications={notifications} 
        onRemove={removeNotification} 
      />
    </>
  );
}

export function ConditionalLayout({ children, faviconUrl }: ConditionalLayoutProps) {
  return (
    <SocialProofProvider>
      <LayoutContent faviconUrl={faviconUrl}>
        {children}
      </LayoutContent>
    </SocialProofProvider>
  );
} 