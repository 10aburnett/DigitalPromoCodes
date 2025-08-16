'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatisticsData {
  totalUsers: number;
  totalOffersAvailable: number;
  promoCodesClaimed: number;
  mostClaimedOffer: {
    name: string;
    slug: string;
    claimCount: number;
    logoUrl?: string;
  } | null;
}

export default function StatisticsSection() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      if (hasLoaded) return;
      
      setLoading(true);
      setHasLoaded(true);
      
      try {
        const response = await fetch('/api/statistics');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          fetchStatistics();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded]);

  // Animated counter hook
  const useCounter = (end: number, duration: number = 2000) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
      if (end === 0) return;
      
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        setCount(Math.floor(progress * end));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [end, duration]);

    return count;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Show placeholder when not yet loaded or while loading
  if (!hasLoaded || loading) {
    return (
      <section 
        ref={sectionRef} 
        id="platform-stats"
        className="
          stats-section
          pt-5 md:pt-16                    /* increased mobile padding from default to pt-5 */
          pb-10 md:pb-16 mb-2 md:mb-12 
          border-t-0 md:border-t md:border-white/10   /* hide mobile border, keep desktop */
        " 
        style={{ backgroundColor: 'var(--background-secondary)' }}
      >
        <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>{t('home.statistics')}</h2>
            <p className="max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              {t('footer.description')}
            </p>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="w-full h-[164px] md:h-auto rounded-2xl border p-4 md:p-6 animate-pulse flex flex-col items-center justify-center overflow-hidden" style={{ 
                    backgroundColor: 'var(--background-color)', 
                    borderColor: 'var(--border-color)' 
                  }}>
                    <div className="h-8 rounded mb-2" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                    <div className="h-4 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent" style={{ borderColor: 'var(--accent-color)', borderRightColor: 'transparent' }}></div>
              <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>Loading statistics...</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const StatCard = ({ 
    title, 
    value, 
    suffix = '', 
    link = null,
    icon,
    showLogo = false,
    logoUrl
  }: { 
    title: string; 
    value: number | string; 
    suffix?: string;
    link?: string | null;
    icon: string | React.ReactElement;
    showLogo?: boolean;
    logoUrl?: string;
  }) => {
    const animatedValue = typeof value === 'number' ? useCounter(value) : value;
    
    const content = (
      <div className="w-full h-[164px] md:h-auto rounded-2xl border p-4 md:p-6 flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg" style={{ 
        backgroundColor: 'var(--background-color)', 
        borderColor: 'var(--border-color)',
        ':hover': { borderColor: 'var(--accent-color)' }
      }}>
        {showLogo && logoUrl ? (
          <div className="w-8 h-8 mx-auto mb-1 rounded-md overflow-hidden flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <img 
              src={logoUrl} 
              alt={`${value} logo`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="text-lg hidden" style={{ color: 'var(--accent-color)' }}>{typeof icon === 'string' ? icon : <div>{icon}</div>}</div>
          </div>
        ) : (
          <div className="mb-1 shrink-0 text-2xl" style={{ color: 'var(--accent-color)' }}>
            {typeof icon === 'string' ? icon : icon}
          </div>
        )}
        <div className="text-2xl font-semibold leading-tight" style={{ color: 'var(--text-color)' }}>
          {typeof animatedValue === 'number' ? formatNumber(animatedValue) : animatedValue}{suffix}
        </div>
        <div className="mt-0.5 text-sm leading-snug line-clamp-2 mb-2 md:mb-6" style={{ color: 'var(--text-secondary)' }}>{title}</div>
      </div>
    );

    if (link) {
      return (
        <Link href={link} className="block">
          {content}
        </Link>
      );
    }

    return content;
  };

  return (
    <section 
      ref={sectionRef} 
      id="platform-stats"
      className="
        stats-section
        -mt-8 md:mt-0 
        pt-5 md:pt-16                    /* increased mobile padding from pt-1 to pt-5 */
        pb-10 md:pb-16 mb-2 md:mb-12 
        border-t-0 md:border-t md:border-white/10   /* hide mobile border, keep desktop */
      " 
      style={{ backgroundColor: 'var(--background-secondary)' }}
    >
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>{t('home.statistics')}</h2>
          <p className="max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            {t('footer.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:gap-6">
          <StatCard
            title={t('stats.users')}
            value={stats?.totalUsers || 0}
            icon="👥"
          />
          <StatCard
            title={t('stats.whops')}
            value={stats?.totalOffersAvailable || 0}
            icon="🎯"
          />
          <StatCard
            title={t('stats.claimed')}
            value={stats?.promoCodesClaimed || 0}
            icon="🎉"
          />
          <StatCard
            title={t('stats.popular')}
            value={stats?.mostClaimedOffer?.name || 'N/A'}
            icon="⭐"
            link={stats?.mostClaimedOffer?.slug ? `/whop/${stats.mostClaimedOffer.slug}` : undefined}
            logoUrl={stats?.mostClaimedOffer?.logoUrl}
            showLogo={true}
          />
        </div>
      </div>
    </section>
  );
} 