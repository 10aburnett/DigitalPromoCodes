'use client';

import { useState, useEffect } from 'react';
import { fileSlug } from '@/lib/slug-utils';

interface LedgerEntry {
  code: string;
  status: 'working' | 'expired' | 'unknown';
  beforeCents?: number;
  afterCents?: number;
  currency?: string;
  display?: string;
  notes?: string;
  checkedAt?: string;
  verifiedAt?: string;
  maskInLedger?: boolean;
}

interface WhopFreshnessData {
  whopUrl: string;
  lastUpdated: string;
  ledger: LedgerEntry[];
}

interface WhopFreshnessProps {
  slug: string;
}

// Human-readable date formatter (no Z suffix)
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Get status display text
function getStatusLabel(status: string): string {
  switch (status) {
    case 'working': return 'Active';
    case 'expired': return 'Inactive';
    default: return 'Pending';
  }
}

export default function WhopFreshness({ slug }: WhopFreshnessProps) {
  const [freshnessData, setFreshnessData] = useState<WhopFreshnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('WhopFreshness component rendered for slug:', slug);

  useEffect(() => {
    async function loadFreshnessData() {
      try {
        console.log('Fetching freshness data for:', slug);
        // Use fileSlug to get proper encoding for the JSON file
        const encodedSlug = fileSlug(slug);
        const response = await fetch(`/api/data/pages/${encodedSlug}.json`);
        console.log('API response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Freshness data loaded:', data);
          setFreshnessData(data);
        } else {
          console.log('API response not ok:', response.status, response.statusText);
          setError('No freshness data available');
        }
      } catch (err) {
        console.error('Error loading freshness data:', err);
        setError('Failed to load freshness data');
      } finally {
        setLoading(false);
      }
    }

    // Only run on client side
    if (typeof window !== 'undefined') {
      loadFreshnessData();
    } else {
      // On server side, just set loading to false
      setLoading(false);
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="rounded-xl px-7 py-6 sm:p-8 border transition-theme animate-pulse" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
        <div className="h-6 bg-gray-200/40 rounded mb-4"></div>
        <div className="h-4 bg-gray-200/40 rounded mb-2"></div>
        <div className="h-20 bg-gray-200/40 rounded"></div>
      </div>
    );
  }

  if (error || !freshnessData) {
    // No freshness data available - don't render anything
    return null;
  }

  return (
    <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
      <h2 className="text-xl sm:text-2xl font-bold mb-4">Code Status</h2>

      {/* Last scan timestamp */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <svg className="w-4 h-4 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Scanned: <span className="font-medium" style={{ color: 'var(--text-color)' }}>{formatDateTime(freshnessData.lastUpdated)}</span>
        </span>
      </div>

      {/* Code entries - clean list format */}
      {freshnessData.ledger && freshnessData.ledger.length > 0 && (
        <div className="space-y-3">
          {freshnessData.ledger.map((row, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border"
              style={{ backgroundColor: 'var(--background-color)', borderColor: 'var(--border-color)' }}
            >
              {/* Status badge and savings */}
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  row.status === 'working' ? 'bg-green-100 text-green-700' :
                  row.status === 'expired' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {getStatusLabel(row.status)}
                </span>
                {row.display && (
                  <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>
                    {row.display}
                  </span>
                )}
              </div>

              {/* Verification date */}
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {row.verifiedAt ? (
                  <span>Confirmed {formatDateTime(row.verifiedAt)}</span>
                ) : row.checkedAt ? (
                  <span>Reviewed {formatDateTime(row.checkedAt)}</span>
                ) : (
                  <span>Awaiting review</span>
                )}
              </div>

              {/* Notes if present */}
              {row.notes && (
                <p className="text-xs mt-2 pt-2 border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                  {row.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><span className="text-green-600 font-medium">Confirmed</span> = tested at checkout</span>
          <span><span className="text-blue-600 font-medium">Reviewed</span> = code existence verified</span>
        </div>
      </div>
    </section>
  );
}