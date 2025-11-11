export default function Loading() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header skeleton */}
        <div className="animate-pulse space-y-4">
          {/* Back button */}
          <div className="h-10 bg-gray-200 rounded w-24" style={{ backgroundColor: 'var(--background-secondary)' }}></div>

          {/* Logo and title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--background-secondary)' }}></div>
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" style={{ backgroundColor: 'var(--background-secondary)' }}></div>
              <div className="h-4 bg-gray-200 rounded w-1/2" style={{ backgroundColor: 'var(--background-secondary)' }}></div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3 mb-6">
            <div className="h-12 bg-gray-200 rounded-lg flex-1" style={{ backgroundColor: 'var(--background-secondary)' }}></div>
            <div className="h-12 bg-gray-200 rounded-lg flex-1" style={{ backgroundColor: 'var(--background-secondary)' }}></div>
          </div>

          {/* Content sections */}
          <div className="space-y-6">
            {/* Promo codes section */}
            <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
              <div className="space-y-3">
                <div className="h-20 bg-gray-200 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                <div className="h-20 bg-gray-200 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
              </div>
            </div>

            {/* Description section */}
            <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                <div className="h-4 bg-gray-200 rounded w-5/6" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                <div className="h-4 bg-gray-200 rounded w-4/5" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
              </div>
            </div>

            {/* Features section */}
            <div className="p-6 rounded-xl border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="h-16 bg-gray-200 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                <div className="h-16 bg-gray-200 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                <div className="h-16 bg-gray-200 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
                <div className="h-16 bg-gray-200 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
