'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

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
  compact?: boolean;
}

export interface PromoStatsDisplayHandle {
  refresh: () => void;
}

const PromoStatsDisplay = forwardRef<PromoStatsDisplayHandle, PromoStatsDisplayProps>(
  ({ whopId, promoCodeId, compact = false }, ref) => {
    const [stats, setStats] = useState<PromoStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchStats = async () => {
      try {
        setError(null);
        setLoading(true);
        const params = new URLSearchParams();
        if (promoCodeId) {
          params.append('promoCodeId', promoCodeId);
        } else {
          params.append('whopId', whopId);
        }

        console.log('🔍 PromoStatsDisplay: Fetching stats with params:', { whopId, promoCodeId });
        
        const url = `/api/promo-stats?${params}`;
        console.log('🔍 PromoStatsDisplay: Fetching URL:', url);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ PromoStatsDisplay: Received data:', data);
          
          // If we requested stats for a specific promo code, use that data
          if (promoCodeId && data.promoCode) {
            setStats(data);
          } 
          // If we requested whop stats and got an array, use the first promo code
          else if (data.promoStats && data.promoStats.length > 0) {
            setStats(data.promoStats[0]);
          } else {
            console.warn('⚠️ PromoStatsDisplay: No valid stats data found in response');
          }
        } else {
          const errorText = await response.text();
          console.error('❌ PromoStatsDisplay: API error:', response.status, errorText);
          setError(`Failed to load stats (${response.status})`);
        }
      } catch (error) {
        console.error('❌ PromoStatsDisplay: Error fetching promo stats:', error);
        setError('Unable to load usage statistics');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchStats();
    }, [whopId, promoCodeId]);

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
        
        return date.toLocaleDateString();
      } catch (e) {
        return 'Unknown';
      }
    };

    const formatVerifiedDate = (dateString: string) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
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
      <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-color)' }}>
          Code Usage Statistics
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Last Used */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last Used</div>
              <div className="font-medium" style={{ color: 'var(--text-color)' }}>
                {formatRelativeTime(stats.usage.lastUsed)}
              </div>
            </div>
          </div>

          {/* Usage Today */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--success-color)' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Used Today</div>
              <div className="font-medium" style={{ color: 'var(--text-color)' }}>
                {stats.usage.todayCount} time{stats.usage.todayCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Total Usage */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Uses</div>
              <div className="font-medium" style={{ color: 'var(--text-color)' }}>
                {stats.usage.totalCount} time{stats.usage.totalCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Date Verified */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--warning-color)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Date Verified</div>
              <div className="font-medium" style={{ color: 'var(--text-color)' }}>
                {formatVerifiedDate(stats.usage.verifiedDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {stats.usage.totalCount > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success-color)' }}></div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This code is actively being used by our community
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