export default function Loading() {
  return (
    <main className="min-h-screen py-12 pt-24 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-6xl">
        {/* Main Content Container */}
        <div className="max-w-2xl mx-auto space-y-6 mb-8">
          {/* Hero Section Skeleton */}
          <div className="rounded-xl px-7 py-6 sm:p-8 shadow-lg border transition-theme" style={{ background: 'linear-gradient(to bottom right, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col gap-4">
              {/* Whop Info Skeleton */}
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-lg bg-gray-200/40 dark:bg-white/10 animate-pulse flex-shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <div className="h-8 sm:h-9 w-64 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-2"></div>
                  <div className="h-6 w-40 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
                  <div className="mt-3">
                    <div className="h-8 w-32 rounded-full bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Community Promo Section Skeleton */}
              <div className="mt-1">
                <hr className="mb-4" style={{ borderColor: 'var(--border-color)', borderWidth: '1px', opacity: 0.3 }} />
                <div className="h-24 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              </div>

              {/* Submit Button Skeleton */}
              <div className="mt-6">
                <div className="h-16 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* How to Redeem Section Skeleton */}
          <div className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="h-7 w-48 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-4"></div>
            <div className="space-y-3">
              <div className="h-5 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              <div className="h-5 w-5/6 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              <div className="h-5 w-4/5 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              <div className="h-5 w-3/4 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
            </div>
          </div>

          {/* Product Details Skeleton */}
          <div className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="h-7 w-56 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-4"></div>
            <div className="h-32 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
          </div>

          {/* About Section Skeleton */}
          <div className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="h-7 w-48 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-4"></div>
            <div className="space-y-3">
              <div className="h-5 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              <div className="h-5 w-11/12 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              <div className="h-5 w-5/6 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
            </div>
          </div>

          {/* Promo Details Skeleton */}
          <div className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="h-7 w-40 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-4"></div>
            <div className="h-24 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
          </div>
        </div>

        {/* Full-width sections skeleton */}
        <div className="w-full space-y-8">
          {/* Recommended Section Skeleton */}
          <div className="max-w-2xl mx-auto">
            <div className="h-8 w-48 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-6"></div>
            <div className="grid gap-4">
              <div className="h-32 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
              <div className="h-32 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
            </div>
          </div>

          {/* Reviews Section Skeleton */}
          <div className="max-w-2xl mx-auto">
            <div className="h-8 w-32 rounded bg-gray-200/40 dark:bg-white/10 animate-pulse mb-6"></div>
            <div className="h-48 w-full rounded bg-gray-200/40 dark:bg-white/10 animate-pulse"></div>
          </div>
        </div>
      </div>
    </main>
  );
}