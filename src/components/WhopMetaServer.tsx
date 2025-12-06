// src/components/WhopMetaServer.tsx
// Server component for usage metrics and code status display

export const dynamic = 'force-dynamic'; // this block computes per-request stats

import { stableNormalize, djb2, toIso } from '@/lib/hydration-debug';

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
  debugOnly?: string; // 'last', 'today', 'total', 'verified', 'ledger'
}

// Human-readable date formatter (no Z suffix)
function formatDateTime(value: string | Date | null | undefined): string {
  const iso = value ? toIso(value) : null;
  if (!iso) return 'Not available';

  const date = new Date(iso);
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

export default function WhopMetaServer({ usageStats, freshnessData, debugOnly }: WhopMetaServerProps) {
  // Compute stable snapshot + hash for debugging
  const snapshot = stableNormalize({
    usage: {
      todayCount: usageStats?.todayCount ?? 0,
      totalCount: usageStats?.totalCount ?? 0,
      lastUsed: toIso(usageStats?.lastUsed ?? null),
      verifiedDate: toIso(usageStats?.verifiedDate ?? null),
    },
    freshness: freshnessData ? {
      lastUpdated: toIso(freshnessData.lastUpdated),
      ledger: (freshnessData.ledger ?? []).map(r => ({
        status: r.status,
        display: r.display ?? null,
        notes: r.notes ?? null,
        checkedAt: toIso(r.checkedAt ?? null),
        verifiedAt: toIso(r.verifiedAt ?? null),
      }))
    } : null
  });
  const serverHash = djb2(JSON.stringify(snapshot));

  return (
    <>
      {/* Usage Metrics - Server Rendered */}
      {(!debugOnly || ['last', 'today', 'total', 'verified'].includes(debugOnly)) && (
        <section
          id="dpc-meta"
          data-hash={serverHash}
          className="rounded-lg p-4 border mt-6"
          style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}
        >
          {/* Server snapshot for client diffing */}
          <script
            id="dpc-meta-snapshot"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(snapshot) }}
          />

          <h2 className="text-xl sm:text-2xl font-bold mb-4">Usage Metrics</h2>

          <div className="space-y-3">
            {/* Last Activity */}
            {(!debugOnly || debugOnly === 'last') && (
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last Activity</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
                  {formatDateTime(usageStats.lastUsed)}
                </span>
              </div>
            )}

            {/* Today */}
            {(!debugOnly || debugOnly === 'today') && (
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Today</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
                  {usageStats.todayCount} use{usageStats.todayCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Total */}
            {(!debugOnly || debugOnly === 'total') && (
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
                  {usageStats.totalCount} use{usageStats.totalCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Verified */}
            {(!debugOnly || debugOnly === 'verified') && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Verified</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>
                  {formatDateTime(usageStats.verifiedDate)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Code Status - Server Rendered */}
      {(!debugOnly || debugOnly === 'ledger') && freshnessData && (
        <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme mt-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
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
      )}
    </>
  );
}
