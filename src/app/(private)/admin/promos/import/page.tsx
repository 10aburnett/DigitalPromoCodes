"use client";

import { useState } from "react";

export default function PromoImportPage() {
  const [csv, setCsv] = useState("");
  const [dry, setDry] = useState(true);
  const [allowFuzzy, setAllowFuzzy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string; kind: "ok" | "err"} | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
  }

  async function onImport() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/promos/bulk-import?dry=${dry ? "1" : ""}${!dry && allowFuzzy ? "&fuzzy=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: csv
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      setResult(json);
      setToast({
        msg: `Imported ✓  created:${json.created}  better:${json.updatedBetter}  touched:${json.touched}  missing:${json.missing}  invalid:${json.invalid}`,
        kind: "ok"
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setError(err?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm ${toast.kind === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Promo Codes — CSV Import
          </h1>
          <p className="text-gray-300 mb-4">
            Bulk import promo codes from scraped CSV data. Matches Whops by URL and upserts codes.
          </p>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-2">
              <strong className="text-white">Expected CSV header:</strong>
            </p>
            <code className="block bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">
              whopUrl,code,discountType,discountValue,currency,amountMinor,stacking,expiresAt,capturedAt,provenance
            </code>
          </div>
        </div>

        <div className="space-y-6">
          {/* File Upload */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
          </div>

          {/* CSV Textarea */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Or Paste CSV Here
            </label>
            <textarea
              className="w-full h-60 p-3 bg-gray-900 border border-gray-700 rounded text-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Paste CSV content here..."
              value={csv}
              onChange={e => setCsv(e.target.value)}
            />
          </div>

          {/* Options & Submit */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex gap-6 mb-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dry}
                  onChange={() => setDry(v => !v)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300">
                  Dry run (preview only, no database writes)
                </span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowFuzzy}
                  onChange={() => setAllowFuzzy(v => !v)}
                  disabled={dry}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-gray-300">
                  Allow fuzzy match for writes (dry run always uses fuzzy)
                </span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onImport}
                disabled={busy || !csv.trim()}
                className="px-6 py-3 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "Importing..." : dry ? "Preview Import (Dry Run)" : "Import CSV"}
              </button>
              {!dry && allowFuzzy && (
                <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-300 border border-yellow-500">
                  Fuzzy write ON
                </span>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
              <p className="text-red-400 font-medium">Error:</p>
              <p className="text-red-300 mt-1">{error}</p>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Import Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-green-900/20 border border-green-500 rounded p-3">
                  <p className="text-green-400 text-sm">Created</p>
                  <p className="text-2xl font-bold text-green-300">{result.created}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500 rounded p-3">
                  <p className="text-blue-400 text-sm">Updated (Better)</p>
                  <p className="text-2xl font-bold text-blue-300">{result.updatedBetter}</p>
                </div>
                <div className="bg-gray-700 border border-gray-600 rounded p-3">
                  <p className="text-gray-400 text-sm">Touched</p>
                  <p className="text-2xl font-bold text-gray-300">{result.touched}</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-500 rounded p-3">
                  <p className="text-yellow-400 text-sm">Missing Whop</p>
                  <p className="text-2xl font-bold text-yellow-300">{result.missing}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500 rounded p-3">
                  <p className="text-red-400 text-sm">Invalid</p>
                  <p className="text-2xl font-bold text-red-300">{result.invalid}</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500 rounded p-3">
                  <p className="text-purple-400 text-sm">Total Rows</p>
                  <p className="text-2xl font-bold text-purple-300">
                    {result.created + result.updatedBetter + result.touched + result.missing + result.invalid}
                  </p>
                </div>
              </div>

              {/* Errors List */}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-medium text-white mb-2">
                    Errors ({result.errors.length})
                  </h3>
                  <div className="bg-gray-900 border border-gray-700 rounded p-3 max-h-60 overflow-y-auto">
                    {result.errors.map((err: string, i: number) => (
                      <p key={i} className="text-red-300 text-sm font-mono mb-1">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <details className="mt-4">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-300 text-sm">
                  Show raw JSON response
                </summary>
                <pre className="bg-gray-900 border border-gray-700 rounded p-3 mt-2 text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
