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

// Helper function to format dates in London timezone
function formatLondon(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

// Helper function to mask promo codes
function maskCode(code: string): string {
  if (!code) return "Hidden";
  if (code.length > 8) {
    return `${code.slice(0, 5)}…${code.slice(-3)}`;
  }
  return "Hidden until reveal";
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
      <h2 className="text-xl sm:text-2xl font-bold mb-4">Verification Info</h2>

      {/* Last Updated */}
      <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
        <p className="text-sm font-medium text-green-600 mb-1">
          ✅ Last checked: {formatLondon(freshnessData.lastUpdated)} (server-rendered)
        </p>
      </div>

      {/* Codes Ledger */}
      {freshnessData.ledger && freshnessData.ledger.length > 0 && (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <table className="min-w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--background-color)' }}>
                <th className="py-2 pl-4 pr-2 text-left text-sm font-medium">Status</th>
                <th className="py-2 px-2 text-left text-sm font-medium">Before → After</th>
                <th className="py-2 px-2 text-left text-sm font-medium">Verification</th>
                <th className="py-2 pl-2 pr-4 text-left text-sm font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {freshnessData.ledger.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? '' : 'bg-opacity-50'}
                  style={{ backgroundColor: index % 2 === 0 ? 'var(--background-secondary)' : 'var(--background-color)' }}
                >
                  <td className="py-2 pl-4 pr-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.status === 'working' ? 'bg-green-100 text-green-800' :
                      row.status === 'expired' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-sm">
                    {row.display || '—'}
                  </td>
                  <td className="py-2 px-2 text-sm">
                    {row.verifiedAt ? (
                      <span className="text-green-600 font-medium">
                        Last verified {formatLondon(row.verifiedAt)}
                      </span>
                    ) : row.checkedAt ? (
                      <span className="text-blue-600">
                        Last checked {formatLondon(row.checkedAt)}
                      </span>
                    ) : (
                      <span className="text-gray-500">Unverified</span>
                    )}
                  </td>
                  <td className="py-2 pl-2 pr-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {row.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>
          <span className="text-green-600 font-medium">Verified</span> means we tested the code at checkout.
          <span className="text-blue-600 font-medium ml-2">Last checked</span> means we recently confirmed the code exists.
        </p>
      </div>
    </section>
  );
}