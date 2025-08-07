'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console
    console.error('Blog page error:', error)
  }, [error])

  return (
    <div className="min-h-screen py-8 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1200px]">
        <div className="text-center py-16">
          <div className="p-8 rounded-lg border" style={{ 
            backgroundColor: 'var(--background-secondary)', 
            borderColor: 'var(--border-color)' 
          }}>
            <div className="mb-4 text-6xl">💥</div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
              Blog Temporarily Unavailable
            </h2>
            <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
              We're experiencing technical difficulties with the blog system. Our team has been notified and is working on a fix.
            </p>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={reset}
                  className="px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90 mr-4"
                  style={{ 
                    backgroundColor: 'var(--accent-color)', 
                    color: 'white' 
                  }}
                >
                  Try Again
                </button>
                
                <a 
                  href="/"
                  className="inline-block px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
                  style={{ 
                    backgroundColor: 'var(--background-tertiary)', 
                    color: 'var(--text-color)',
                    textDecoration: 'none',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  Back to Home
                </a>
              </div>
            </div>

            {/* Debug info for development */}
            <details className="text-left mt-8">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Error Details (for debugging)
              </summary>
              <div className="text-sm p-4 rounded bg-gray-100 dark:bg-gray-800 overflow-x-auto">
                <pre style={{ color: 'var(--text-muted)' }}>
                  {error.message}
                  {error.digest && `\nError ID: ${error.digest}`}
                </pre>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}