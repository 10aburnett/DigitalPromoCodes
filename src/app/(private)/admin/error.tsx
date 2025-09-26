'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#292932] text-white rounded-lg border border-[#404055]">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
        <p className="text-[#a7a9b4] mb-6">
          An error occurred in the admin panel. The error has been logged.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-[#68D08B] text-white rounded-md hover:bg-[#5abc7a] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="px-6 py-3 bg-[#404055] text-white rounded-md hover:bg-[#4c4c65] transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 