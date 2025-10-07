// src/components/WhopMetaServer.tsx
// Server component for promo usage statistics and verification status

interface UsageStats {
  todayCount: number;
  totalCount: number;
  lastUsed: string | Date | null;  // Accept Date from server
  verifiedDate: string | Date;
}

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

interface FreshnessData {
  whopUrl: string;
  lastUpdated: string;
  ledger: LedgerEntry[];
}

interface WhopMetaServerProps {
  usageStats: UsageStats;
  freshnessData?: FreshnessData | null;
}

// Helper function to format dates in London timezone
function formatLondon(isoString: string | Date): string {
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

function formatRelativeTime(dateString: string | Date | null) {
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
}

function formatVerifiedDate(dateString: string | Date) {
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
}

export default function WhopMetaServer({ usageStats, freshnessData }: WhopMetaServerProps) {
  return (
    <>
      {/* Promo Usage Statistics - Server Rendered */}
      <section className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
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
                {formatRelativeTime(usageStats.lastUsed)}
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
                {usageStats.todayCount} time{usageStats.todayCount !== 1 ? 's' : ''}
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
                {usageStats.totalCount} time{usageStats.totalCount !== 1 ? 's' : ''}
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
                {formatVerifiedDate(usageStats.verifiedDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {usageStats.totalCount > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="
                  inline-block shrink-0
                  h-1.5 w-1.5
                  rounded-full
                  bg-emerald-500
                  ring-1 ring-emerald-200/40

                  md:h-2 md:w-2
                  md:rounded-md
                "
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This code is actively being used by our community
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Verification Status - Server Rendered */}
      {freshnessData && (
        <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme mt-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Verification Status</h2>

          {/* Last Updated */}
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
            <p className="text-sm font-medium text-green-600 mb-1">
              ✅ Last checked: {formatLondon(freshnessData.lastUpdated)}
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
      )}
    </>
  );
}
