// Server component for Verification Status only
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

// Stable ISO formatter (no locale, no "x minutes ago")
function fmtISO(value: string | Date | null | undefined) {
  const iso = value ? toIso(value) : null;
  return iso ? iso.slice(0, 16).replace('T', ' ') + 'Z' : 'Never'; // e.g. 2025-03-11 14:22Z
}

export default function VerificationStatus({ freshnessData }: VerificationStatusProps) {
  return (
    <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme mt-6" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
      <h2 className="text-xl sm:text-2xl font-bold mb-4">Verification Status</h2>

      {/* Last Updated */}
      <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--background-color)' }}>
        <p className="text-sm font-medium text-green-600 mb-1">
          ✅ Last checked: {fmtISO(freshnessData.lastUpdated)}
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
                        Last verified {fmtISO(row.verifiedAt)}
                      </span>
                    ) : row.checkedAt ? (
                      <span className="text-blue-600">
                        Last checked {fmtISO(row.checkedAt)}
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
