"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Clear all authentication data when component mounts
  useEffect(() => {
    // Clear all possible authentication cookies
    const cookiesToClear = [
      'admin-token',
      'nextauth.session-token',
      'next-auth.csrf-token',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.csrf-token'
    ];

    cookiesToClear.forEach(cookieName => {
      // Clear for current domain
      document.cookie = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      // Clear for subdomain
      document.cookie = `${cookieName}=; Path=/; Domain=${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
      // Clear with secure flag
      document.cookie = `${cookieName}=; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    });

    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    console.log('Cleared all authentication data');
  }, []);

  const clearAllCache = () => {
    // Clear all possible authentication cookies
    const cookiesToClear = [
      'admin-token',
      'nextauth.session-token',
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'nextauth.csrf-token',
      'nextauth.csrf-token',
      '__Host-next-auth.csrf-token'
    ];

    cookiesToClear.forEach(cookieName => {
      // Clear for current domain
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      // Clear for localhost specifically
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;
      // Clear for .localhost
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.localhost;`;
    });

    // Clear all localStorage
    try {
      localStorage.clear();
    } catch (e) {
      console.log('Could not clear localStorage:', e);
    }

    // Clear all sessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.log('Could not clear sessionStorage:', e);
    }

    // Clear any cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    toast.success("Browser cache cleared! Please refresh the page.");
    
    // Force a hard refresh after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const debugAuthState = () => {
    console.log("=== AUTHENTICATION DEBUG ===");
    
    // Show all cookies
    console.log("All cookies:", document.cookie);
    
    // Show localStorage
    console.log("localStorage items:");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(`  ${key}: ${localStorage.getItem(key)}`);
    }
    
    // Show sessionStorage
    console.log("sessionStorage items:");
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      console.log(`  ${key}: ${sessionStorage.getItem(key)}`);
    }
    
    // Test admin-token specifically
    const adminToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('admin-token='))
      ?.split('=')[1];
    console.log("admin-token value:", adminToken);
    
    toast.success("Debug info logged to console. Press F12 to view.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // We're using the direct API without NextAuth
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Login successful!");
        // Small delay to ensure cookie is set
        setTimeout(() => {
          router.push("/admin");
          router.refresh();
        }, 100);
      } else {
        setError(data.error || "Invalid email or password. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#343541] px-4">
      <div className="w-full max-w-md mx-auto">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="text-4xl font-bold text-[#6366f1]">
              WHPCodes
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Admin Portal</h1>
        </div>

        {/* Login Form */}
        <div className="bg-[#292932] shadow-xl rounded-xl border border-[#404055] overflow-hidden">
          <div className="px-8 py-8">
            {error && (
              <div className="mb-6 bg-red-900/20 border border-red-800/30 text-red-400 text-sm p-4 rounded-lg flex items-center">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-[#a7a9b4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="block w-full pl-10 pr-4 py-3 border border-[#404055] placeholder-[#6b7280] text-white rounded-lg bg-[#3c3f4a] focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200 sm:text-sm"
                      placeholder="example@email.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-[#a7a9b4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full pl-10 pr-4 py-3 border border-[#404055] placeholder-[#6b7280] text-white rounded-lg bg-[#3c3f4a] focus:outline-none focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200 sm:text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#68D08B] hover:bg-[#5abc7a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#68D08B] focus:ring-offset-[#292932] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign in to Dashboard
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          {/* Footer */}
          <div className="px-8 py-4 bg-[#373946] border-t border-[#404055]">
            <p className="text-xs text-[#a7a9b4] text-center">
              Secure admin access • WHPCodes Management Portal
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center mt-6 space-y-3">
          <button
            onClick={clearAllCache}
            className="text-xs text-[#68D08B] hover:text-[#5abc7a] underline transition-colors duration-200"
          >
            Having login issues? Clear browser cache
          </button>
          <button
            onClick={debugAuthState}
            className="text-xs text-[#68D08B] hover:text-[#5abc7a] underline transition-colors duration-200"
          >
            Debug authentication state
          </button>
          <p className="text-xs text-[#6b7280]">
            Contact your system administrator for support
          </p>
        </div>
      </div>
    </div>
  );
} 