import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#292932] text-white rounded-lg border border-[#404055]">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
        <p className="text-[#a7a9b4] mb-6">
          The admin page you were looking for could not be found.
        </p>
        <Link
          href="/admin"
          className="px-6 py-3 bg-[#68D08B] text-white rounded-md hover:bg-[#5abc7a] transition-colors inline-block"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
} 