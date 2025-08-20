import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen py-12 pt-24 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-4xl">
        <div className="max-w-2xl mx-auto text-center py-20">
          <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
          <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
            The page you are looking for does not exist or has been moved.
          </p>
          <Link 
            href="/" 
            className="inline-block px-6 py-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
} 