'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Stable formatters for SSR/CSR hydration (no locale drift)
const nf = new Intl.NumberFormat('en-US');
const df = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

function fmtNum(n?: number | null) {
  return nf.format(Number(n || 0));
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return df.format(new Date(iso));
}

interface PromoStats {
  promoCode: {
    id: string;
    title: string;
    code: string | null;
    type: string;
    value: string;
    createdAt: string;
    whopName?: string;
  };
  usage: {
    todayCount: number;
    totalCount: number;
    todayClicks?: number;
    lastUsed: string | null;
    verifiedDate: string;
  };
}

interface PromoStatsDisplayProps {
  whopId: string;
  promoCodeId?: string;
  slug?: string;
  compact?: boolean;
  initialStats?: {
    todayCount: number;
    totalCount: number;
    lastUsed: string | null;
    verifiedDate: string;
  };
}

export interface PromoStatsDisplayHandle {
  refresh: () => void;
}

const PromoStatsDisplay = forwardRef<PromoStatsDisplayHandle, PromoStatsDisplayProps>(
  ({ whopId, promoCodeId, slug, compact = false, initialStats }, ref) => {
    // Initialize with server-rendered stats for SSR/SSG support
    const [stats, setStats] = useState<PromoStats | null>(
      initialStats ? {
        promoCode: {
          id: promoCodeId || '',
          title: 'Promo Code',
          code: '',
          type: '',
          value: '',
          createdAt: new Date().toISOString()
        },
        usage: {
          todayCount: initialStats.todayCount,
          totalCount: initialStats.totalCount,
          todayClicks: initialStats.todayCount,
          lastUsed: initialStats.lastUsed,
          verifiedDate: initialStats.verifiedDate
        }
      } : null
    );
    const [loading, setLoading] = useState(!initialStats); // Don't show loading if we have initial stats
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    const fetchStats = async () => {
      try {
        setError(null);
        setLoading(true);
        
        // Derive slug from pathname first
        const derivedSlug = pathname?.split('/').filter(Boolean).pop();
        
        const params = new URLSearchParams();
        if (derivedSlug) params.set('slug', derivedSlug);
        else if (slug) params.set('slug', slug);
        else if (promoCodeId) params.set('promoCodeId', String(promoCodeId));
        else if (whopId) params.set('whopId', String(whopId));

        if (params.toString() === '') return; // nothing to query

        const url = `/api/promo-stats?${params.toString()}&ts=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => null);

        console.log('[promo-stats]', url, data); // TEMP: verify non-zero payload

        // Map new API shape
        const usage = data?.usage ?? null;
        const today = usage?.todayClicks ?? usage?.todayCount ?? 0;
        const total = usage?.totalCount ?? 0;
        const lastUsed = usage?.lastUsed ?? null;

        // Always set stats with the mapped data
        setStats({
          promoCode: {
            id: promoCodeId || '',
            title: 'Promo Code',
            code: '',
            type: '',
            value: '',
            createdAt: new Date().toISOString()
          },
          usage: {
            todayCount: today,
            totalCount: total,
            todayClicks: today,
            lastUsed,
            verifiedDate: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('❌ PromoStatsDisplay: Error fetching promo stats:', error);
        setError('Unable to load usage statistics');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      // Only fetch if we don't have initial stats (progressive enhancement)
      if (!initialStats) {
        fetchStats();
      }
    }, [whopId, promoCodeId, slug, initialStats]);

    // Listen for custom refresh events in compact mode
    useEffect(() => {
      if (compact && containerRef.current) {
        const handleRefresh = () => {
          console.log('🔄 PromoStatsDisplay: Received custom refresh event');
          fetchStats();
        };
        
        const element = containerRef.current;
        element.addEventListener('refreshStats', handleRefresh);
        
        return () => {
          element.removeEventListener('refreshStats', handleRefresh);
        };
      }
    }, [compact]);

    // Expose refresh function via ref
    useImperativeHandle(ref, () => ({
      refresh: () => {
        console.log('🔄 PromoStatsDisplay: Manual refresh triggered');
        fetchStats();
      }
    }));

    const formatRelativeTime = (dateString: string | null) => {
      if (!dateString) return 'Never';
      
      try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;

        return fmtDate(dateString);
      } catch (e) {
        return 'Unknown';
      }
    };

    const formatVerifiedDate = (dateString: string) => {
      try {
        // Use stable formatter for SSR/CSR consistency
        return fmtDate(dateString);
      } catch (e) {
        return 'Unknown';
      }
    };

    if (loading) {
      return (
        <div className="animate-pulse" ref={compact ? containerRef : undefined} data-compact-stats={compact ? 'true' : undefined}>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
          <div className="h-4 bg-gray-200 rounded w-1/2" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
        </div>
      );
    }

    if (error) {
      if (compact) {
        return (
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }} ref={containerRef} data-compact-stats="true">
            <span className="italic">{error}</span>
          </div>
        );
      }
      return (
        <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--error-color)' }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color: 'var(--error-color)' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span style={{ color: 'var(--error-color)' }}>{error}</span>
          </div>
        </div>
      );
    }

    if (!stats) {
      return null;
    }

    if (compact) {
      return (
        <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }} ref={containerRef} data-compact-stats="true">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Last used: {formatRelativeTime(stats.usage.lastUsed)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Used {stats.usage.todayCount} time{stats.usage.todayCount !== 1 ? 's' : ''} today
            </span>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-color)' }}>
          Usage Statistics
        </h3>

        {/* Clean single-column layout for sidebar */}
        <div className="space-y-3">
          {/* Last Used */}
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last Used</span>
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
              {formatRelativeTime(stats.usage.lastUsed)}
            </span>
          </div>

          {/* Usage Today */}
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--success-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Today</span>
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
              {stats.usage.todayCount} use{stats.usage.todayCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Total Usage */}
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total</span>
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
              {stats.usage.totalCount} use{stats.usage.totalCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Date Verified */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--warning-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Verified</span>
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
              {formatVerifiedDate(stats.usage.verifiedDate)}
            </span>
          </div>
        </div>

        {/* Additional Info */}
        {stats.usage.totalCount > 0 && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block shrink-0 h-2 w-2 rounded-full bg-emerald-500"
              />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Actively used by our community
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PromoStatsDisplay.displayName = 'PromoStatsDisplay';

export default PromoStatsDisplay; 