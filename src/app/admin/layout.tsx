"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import './styles.css';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check for admin authentication
  useEffect(() => {
    const checkAuth = async () => {
      if (isLoginPage) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin-auth', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setAdminUser(data.user);
          } else {
            throw new Error('Invalid response format');
          }
        } else {
          // Clear any invalid token and redirect to login
          document.cookie = 'admin-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          setAdminUser(null);
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear any invalid token and redirect to login
        document.cookie = 'admin-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        setAdminUser(null);
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [isLoginPage, router, pathname]);

  // Logout function
  const handleLogout = async () => {
    try {
      // Call the logout API endpoint
      const response = await fetch('/api/admin-logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success('Logged out successfully');
        setAdminUser(null); // Clear the admin user state
        router.push('/admin/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed');
      // Fallback: clear cookie manually and redirect anyway
      document.cookie = 'admin-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      setAdminUser(null);
      router.push('/admin/login');
    }
  };

  // Handle navigation to frontend with clean state
  const handleFrontendNavigation = () => {
    // Force a full page reload to ensure clean state
    window.location.href = '/';
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#343541]">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  // For login page, just show the children without admin UI
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-[#343541] text-white">
        {children}
      </div>
    );
  }

  // Full admin layout for authenticated admin users
  return (
    <div className="min-h-screen bg-[#343541] text-white">
      <nav className="bg-[#292932] shadow-md border-b border-[#404055]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <button
                  onClick={handleFrontendNavigation}
                  className="flex items-center hover:opacity-80 transition-opacity duration-200 bg-transparent border-none cursor-pointer"
                >
                  <div className="text-2xl font-bold text-[#6366f1] mr-6">
                    WHPCodes
                  </div>
                </button>
              </div>
              <div className="ml-6 flex space-x-4 items-center">
                <Link href="/admin" className="text-[#a7a9b4] hover:text-[#68D08B]">Dashboard</Link>
                <Link href="/admin/whops" className="text-[#a7a9b4] hover:text-[#68D08B]">Whops</Link>
                <Link href="/admin/blog" className="text-[#a7a9b4] hover:text-[#68D08B]">Blog</Link>
                <Link href="/admin/reviews" className="text-[#a7a9b4] hover:text-[#68D08B]">Reviews</Link>
                <Link href="/admin/analytics" className="text-[#a7a9b4] hover:text-[#68D08B]">Analytics</Link>
                <Link href="/admin/users" className="text-[#a7a9b4] hover:text-[#68D08B]">Users</Link>
                <Link href="/admin/pages" className="text-[#a7a9b4] hover:text-[#68D08B]">Pages</Link>
                <Link href="/admin/enquiries" className="text-[#a7a9b4] hover:text-[#68D08B]">Enquiries</Link>
                <Link href="/admin/settings" className="text-[#a7a9b4] hover:text-[#68D08B]">Settings</Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-[#a7a9b4]">{adminUser?.email || session?.user?.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
} 