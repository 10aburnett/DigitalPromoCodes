'use client';

import { useEffect } from 'react';

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Blog admin error:', error);
  }, [error]);

  return (
    <div className="p-8">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">Something went wrong in the blog admin.</span>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/admin'}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to Admin
        </button>
      </div>
    </div>
  );
}