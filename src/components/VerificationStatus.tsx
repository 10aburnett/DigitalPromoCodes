// Server component for Code Status display
import { toIso } from '@/lib/hydration-debug';

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

interface VerificationStatusProps {
  freshnessData: FreshnessData;
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

export default function VerificationStatus({ freshnessData }: VerificationStatusProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-color)' }}>
        Code Status
      </h3>

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
    </div>
  );
}
