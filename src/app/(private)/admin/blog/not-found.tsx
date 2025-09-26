import Link from 'next/link';

export default function BlogNotFound() {
  return (
    <div className="p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Blog Page Not Found</h2>
        <p className="text-gray-600 mb-6">
          The blog admin page you were looking for could not be found.
        </p>
        <Link
          href="/admin/blog"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Blog Admin
        </Link>
      </div>
    </div>
  );
}