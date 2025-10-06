import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen py-16 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[800px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
            Page Not Found
          </h1>
          <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
            The page you're looking for doesn't exist or has been moved. Try exploring our blog or browse top Whop deals.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/"
              className="px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
            >
              Back to Home
            </Link>
            <Link
              href="/blog"
              className="px-6 py-3 rounded-lg font-semibold border hover:opacity-80 transition-opacity"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
            >
              Read Our Blog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 