"use client";

import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-[#292932] shadow-md rounded-lg p-6 border border-[#404055]">
        <h2 className="text-2xl font-bold text-white mb-4">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/whops"
            className="block p-6 bg-[#373946] border border-[#404055] rounded-lg shadow-md hover:bg-[#3c3f4a] transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Whops</h3>
            <p className="mt-2 text-[#a7a9b4]">Manage whop listings and promo codes</p>
          </Link>
          <Link
            href="/admin/reviews"
            className="block p-6 bg-[#373946] border border-[#404055] rounded-lg shadow-md hover:bg-[#3c3f4a] transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Reviews</h3>
            <p className="mt-2 text-[#a7a9b4]">Manage user reviews and feedback</p>
          </Link>
          <Link
            href="/admin/analytics"
            className="block p-6 bg-[#373946] border border-[#404055] rounded-lg shadow-md hover:bg-[#3c3f4a] transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Analytics</h3>
            <p className="mt-2 text-[#a7a9b4]">Track offer copies, clicks and engagement</p>
          </Link>
          <Link
            href="/admin/pages"
            className="block p-6 bg-[#373946] border border-[#404055] rounded-lg shadow-md hover:bg-[#3c3f4a] transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Pages</h3>
            <p className="mt-2 text-[#a7a9b4]">Manage website pages and content</p>
          </Link>
          <Link
            href="/admin/enquiries"
            className="block p-6 bg-[#373946] border border-[#404055] rounded-lg shadow-md hover:bg-[#3c3f4a] transition-colors"
          >
            <h3 className="text-lg font-semibold text-white">Enquiries</h3>
            <p className="mt-2 text-[#a7a9b4]">Manage contact form submissions</p>
          </Link>
        </div>
      </div>
    </div>
  );
} 