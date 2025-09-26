"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { normalizeImagePath } from "@/lib/image-utils";
import dynamic from 'next/dynamic';

// Dynamic import for recharts to reduce initial bundle size
const BarChart = dynamic(() => import('recharts').then(mod => ({ default: mod.BarChart })), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => ({ default: mod.Bar })), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(mod => ({ default: mod.LineChart })), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => ({ default: mod.Line })), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.XAxis })), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.YAxis })), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => ({ default: mod.Tooltip })), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => ({ default: mod.Legend })), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })), { ssr: false });
import TimeframeSelector from "./TimeframeSelector";

// Interfaces
interface Promo {
  id: string;
  title: string;
  code: string | null;
  type: string;
  value: string;
  copies: number;
  clicks: number;
}

interface Whop {
  id: string;
  name: string;
  slug: string;
  logo: string;
  totalActions: number;
  copies: number;
  clicks: number;
  promos: Promo[];
}

interface DailyActivity {
  date: string;
  copies: number;
  clicks: number;
  total: number;
}

interface RecentActivity {
  id: string;
  whopName: string;
  whopSlug: string;
  whopLogo: string;
  actionType: string;
  createdAt: string;
  promoTitle: string;
  promoCode: string | null;
}

interface AnalyticsData {
  overall: {
    totalActions: number;
    totalCopies: number;
    totalClicks: number;
  };
  whopAnalytics: Whop[];
  dailyActivity: DailyActivity[];
  recentActivity: RecentActivity[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("today");
  const [selectedWhopId, setSelectedWhopId] = useState<string | null>(null);
  const [whopDetailData, setWhopDetailData] = useState<any | null>(null);
  const [whopDetailLoading, setWhopDetailLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [wipingData, setWipingData] = useState<boolean>(false);
  const [visibleActivityItems, setVisibleActivityItems] = useState<number>(5);
  const [visibleWhopActivityItems, setVisibleWhopActivityItems] = useState<number>(5);
  const [activityPage, setActivityPage] = useState<number>(1);
  const [whopActivityPage, setWhopActivityPage] = useState<number>(1);
  const [activityPageSize, setActivityPageSize] = useState<number>(5);
  const [whopActivityPageSize, setWhopActivityPageSize] = useState<number>(5);
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [imageStates, setImageStates] = useState<{[key: string]: { imagePath: string; imageError: boolean }}>({});
  const router = useRouter();
  const REFRESH_INTERVAL = 30000; // 30 seconds
  const DEFAULT_ACTIVITY_ITEMS = 5;
  const LOAD_MORE_INCREMENT = 10; // Show 10 more items at a time

  const fetchData = async () => {
    try {
      const timestamp = Date.now();
      // Add custom date parameters if using custom timeframe
      let url = `/api/analytics?timeframe=${timeframe}&refresh=true&_=${timestamp}`;
      if (timeframe === 'custom') {
        url += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }
      const analyticsData = await response.json();
      setData(analyticsData);
      setLastRefreshed(new Date());
      
      // Initialize image states for whops
      if (analyticsData.whopAnalytics) {
        const newImageStates: {[key: string]: { imagePath: string; imageError: boolean }} = {};
        analyticsData.whopAnalytics.forEach((whop: Whop) => {
          // Check if logo is empty/null/undefined first
          if (!whop.logo || 
              whop.logo.trim() === '' || 
              whop.logo === 'null' || 
              whop.logo === 'undefined' ||
              whop.logo === 'NULL' ||
              whop.logo === 'UNDEFINED') {
            newImageStates[whop.id] = { imagePath: '', imageError: true };
            return;
          }

          const normalizedPath = normalizeImagePath(whop.logo);
          
          // If the path is empty or clearly invalid, go straight to InitialsAvatar
          if (!normalizedPath || 
              normalizedPath.trim() === '' ||
              normalizedPath === '/images/.png' || 
              normalizedPath === '/images/undefined.png' ||
              normalizedPath === '/images/Simplified Logo.png' ||
              normalizedPath === '/images/null.png' ||
              normalizedPath === '/images/NULL.png' ||
              normalizedPath === '/images/UNDEFINED.png' ||
              normalizedPath.endsWith('/.png') ||
              normalizedPath.includes('/images/undefined') ||
              normalizedPath.includes('/images/null') ||
              normalizedPath.includes('Simplified Logo')) {
            newImageStates[whop.id] = { imagePath: '', imageError: true };
            return;
          }
          
          newImageStates[whop.id] = { imagePath: normalizedPath, imageError: false };
        });
        
        // Also initialize for recent activity
        if (analyticsData.recentActivity) {
          analyticsData.recentActivity.forEach((activity: RecentActivity) => {
            const activityKey = `activity_${activity.id}`;
            if (!activity.whopLogo || 
                activity.whopLogo.trim() === '' || 
                activity.whopLogo === 'null' || 
                activity.whopLogo === 'undefined' ||
                activity.whopLogo === 'NULL' ||
                activity.whopLogo === 'UNDEFINED') {
              newImageStates[activityKey] = { imagePath: '', imageError: true };
              return;
            }

            const normalizedPath = normalizeImagePath(activity.whopLogo);
            
            if (!normalizedPath || 
                normalizedPath.trim() === '' ||
                normalizedPath === '/images/.png' || 
                normalizedPath === '/images/undefined.png' ||
                normalizedPath === '/images/Simplified Logo.png' ||
                normalizedPath === '/images/null.png' ||
                normalizedPath === '/images/NULL.png' ||
                normalizedPath === '/images/UNDEFINED.png' ||
                normalizedPath.endsWith('/.png') ||
                normalizedPath.includes('/images/undefined') ||
                normalizedPath.includes('/images/null') ||
                normalizedPath.includes('Simplified Logo')) {
              newImageStates[activityKey] = { imagePath: '', imageError: true };
              return;
            }
            
            newImageStates[activityKey] = { imagePath: normalizedPath, imageError: false };
          });
        }
        
        setImageStates(newImageStates);
      }
      
      // Reset pagination when new data is loaded
      setActivityPage(1);
      setVisibleActivityItems(DEFAULT_ACTIVITY_ITEMS);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();

    // Reset whop detail view when timeframe changes
    setSelectedWhopId(null);
    setWhopDetailData(null);

    // Set up visibility change listener to refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeframe, customStartDate, customEndDate]);

  const fetchWhopDetails = async (whopId: string) => {
    setWhopDetailLoading(true);
    try {
      const timestamp = Date.now();
      // Add custom date parameters if using custom timeframe
      let url = `/api/analytics?timeframe=${timeframe}&whopId=${whopId}&refresh=true&_=${timestamp}`;
      if (timeframe === 'custom') {
        url += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch whop analytics data");
      }
      const whopData = await response.json();
      setWhopDetailData(whopData);
      setSelectedWhopId(whopId);
      setLastRefreshed(new Date());
      
      // Initialize image state for whop detail
      if (whopData.whopDetails) {
        const whopKey = `whop_detail_${whopData.whopDetails.id || 'current'}`;
        if (!whopData.whopDetails.logo || 
            whopData.whopDetails.logo.trim() === '' || 
            whopData.whopDetails.logo === 'null' || 
            whopData.whopDetails.logo === 'undefined' ||
            whopData.whopDetails.logo === 'NULL' ||
            whopData.whopDetails.logo === 'UNDEFINED') {
          setImageStates(prev => ({
            ...prev,
            [whopKey]: { imagePath: '', imageError: true }
          }));
        } else {
          const normalizedPath = normalizeImagePath(whopData.whopDetails.logo);
          
          if (!normalizedPath || 
              normalizedPath.trim() === '' ||
              normalizedPath === '/images/.png' || 
              normalizedPath === '/images/undefined.png' ||
              normalizedPath === '/images/Simplified Logo.png' ||
              normalizedPath === '/images/null.png' ||
              normalizedPath === '/images/NULL.png' ||
              normalizedPath === '/images/UNDEFINED.png' ||
              normalizedPath.endsWith('/.png') ||
              normalizedPath.includes('/images/undefined') ||
              normalizedPath.includes('/images/null') ||
              normalizedPath.includes('Simplified Logo')) {
            setImageStates(prev => ({
              ...prev,
              [whopKey]: { imagePath: '', imageError: true }
            }));
          } else {
            setImageStates(prev => ({
              ...prev,
              [whopKey]: { imagePath: normalizedPath, imageError: false }
            }));
          }
        }
      }
      
      // Reset pagination when new data is loaded
      setWhopActivityPage(1);
      setVisibleWhopActivityItems(DEFAULT_ACTIVITY_ITEMS);
      
      // Auto-scroll to the top of the page when showing whop details
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) {
      console.error("Error fetching whop analytics data:", error);
    } finally {
      setWhopDetailLoading(false);
    }
  };

  // Memoize the fetch function
  const memoizedFetchData = useCallback(fetchData, [timeframe, customStartDate, customEndDate]);

  // Initial data fetch
  useEffect(() => {
    memoizedFetchData();
  }, [memoizedFetchData]);

  const handleTimeframeChange = (newTimeframe: string) => {
    // Show loading immediately for better UX
    setLoading(true);
    setTimeframe(newTimeframe);
    // Reset pagination when timeframe changes
    setActivityPage(1);
    setVisibleActivityItems(DEFAULT_ACTIVITY_ITEMS);
    setWhopActivityPage(1);
    setVisibleWhopActivityItems(DEFAULT_ACTIVITY_ITEMS);
  };

  const handleCustomDateChange = (startDate: Date, endDate: Date) => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
  };

  const resetCustomDates = () => {
    setCustomStartDate(new Date(new Date().setDate(new Date().getDate() - 7)));
    setCustomEndDate(new Date());
  };

  // Load alternative logo paths to try
  const getAlternativeLogoPaths = (whopName: string, originalPath: string) => {
    const cleanName = whopName.replace(/[^a-zA-Z0-9]/g, '');
    return [
      `/images/${whopName} Logo.png`,
      `/images/${whopName.replace(/\s+/g, '')} Logo.png`,
      `/images/${cleanName} Logo.png`,
      `/images/${cleanName}Logo.png`,
      '/images/Simplified Logo.png'
    ];
  };

  // Try next image in case of error
  const handleImageError = (whopId: string, whopName: string) => {
    const currentState = imageStates[whopId];
    if (!currentState) return;
    
    const { imagePath } = currentState;
    console.error(`Image failed to load: ${imagePath} for ${whopName}`);
    
    // If the current path has @avif, try without it first
    if (imagePath.includes('@avif')) {
      const pathWithoutAvif = imagePath.replace('@avif', '');
      console.log(`Trying without @avif: ${pathWithoutAvif}`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imagePath: pathWithoutAvif }
      }));
      return;
    }
    
    // If the path looks like a placeholder or default image, go straight to InitialsAvatar
    if (imagePath.includes('Simplified Logo') || 
        imagePath.includes('default') || 
        imagePath.includes('placeholder') ||
        imagePath.includes('no-image') ||
        imagePath.includes('missing')) {
      console.log(`Placeholder detected, showing initials for ${whopName}`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imageError: true }
      }));
      return;
    }
    
    // Get alternative paths
    const alternativePaths = getAlternativeLogoPaths(whopName, imagePath);
    const currentIndex = alternativePaths.indexOf(imagePath);
    
    if (currentIndex < alternativePaths.length - 1) {
      // Try next alternative
      const nextPath = alternativePaths[currentIndex + 1];
      console.log(`Trying alternative path: ${nextPath}`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imagePath: nextPath }
      }));
    } else {
      // All alternatives failed, show initials
      console.log(`All image paths failed for ${whopName}, showing initials`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imageError: true }
      }));
    }
  };

  const handleRefresh = () => {
    if (selectedWhopId) {
      fetchWhopDetails(selectedWhopId);
    } else {
      fetchData();
    }
  };

  const handleWipeData = async () => {
    // Show confirmation before wiping
    if (!confirm("Are you sure you want to delete ALL analytics data? This action cannot be undone.")) {
      return;
    }

    setWipingData(true);
    try {
      // Make sure to include credentials to send cookies (both nextauth.session-token and admin-token)
      const response = await fetch('/api/analytics/wipe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // This ensures cookies are sent with the request
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Wipe analytics error:", response.status, errorData);
        throw new Error(errorData.error || `Failed to wipe analytics data (${response.status})`);
      }

      const result = await response.json();
      // Refresh data after wiping
      await memoizedFetchData();
      alert(result.message || "Analytics data successfully wiped");
    } catch (error) {
      console.error("Error wiping analytics data:", error);
      alert(error.message || "Failed to wipe analytics data");
    } finally {
      setWipingData(false);
    }
  };

  const handleBackToDashboard = () => {
    setSelectedWhopId(null);
    setWhopDetailData(null);
    setVisibleActivityItems(DEFAULT_ACTIVITY_ITEMS); // Reset when going back to dashboard
    setVisibleWhopActivityItems(DEFAULT_ACTIVITY_ITEMS); // Reset when going back to dashboard
    fetchData(); // Refresh the main dashboard data
  };

  const renderOverviewStats = () => {
    if (!data) return null;
    
    // Find the whop with the most actions (top offer)
    const topWhop = data.whopAnalytics.length > 0 ? data.whopAnalytics[0] : null;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#2b2d36] p-4 rounded-lg">
          <div className="text-[#a7a9b4] text-sm">Total Actions</div>
          <div className="text-white text-2xl font-bold mt-1">
            {data.overall.totalActions}
          </div>
        </div>
        <div className="bg-[#2b2d36] p-4 rounded-lg">
          <div className="text-[#a7a9b4] text-sm">Code Copies</div>
          <div className="text-white text-2xl font-bold mt-1">
            {data.overall.totalCopies}
          </div>
        </div>
        <div className="bg-[#2b2d36] p-4 rounded-lg">
          <div className="text-[#a7a9b4] text-sm">Offer Clicks</div>
          <div className="text-white text-2xl font-bold mt-1">
            {data.overall.totalClicks}
          </div>
        </div>
        <div className="bg-[#2b2d36] p-4 rounded-lg">
          <div className="text-[#a7a9b4] text-sm">Top Offer</div>
          <div className="text-white text-2xl font-bold mt-1">
            {topWhop ? topWhop.name : 'N/A'}
          </div>
        </div>
      </div>
    );
  };

  const renderWhopTable = () => {
    if (!data?.whopAnalytics || data.whopAnalytics.length === 0) {
      return <p className="text-gray-400">No whop data available</p>;
    }

    return (
      <div className="overflow-x-auto mt-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#2b2d36] text-[#a7a9b4]">
              <th className="p-3 text-left">Whop</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Copies</th>
              <th className="p-3 text-right">Clicks</th>
              <th className="p-3 text-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.whopAnalytics.map((whop) => (
              <tr 
                key={whop.id} 
                className="border-b border-[#404055] hover:bg-[#2b2d36] cursor-pointer"
                onClick={() => fetchWhopDetails(whop.id)}
              >
                <td className="p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 relative rounded-md overflow-hidden flex-shrink-0 bg-gray-800">
                      {(() => {
                        const imageState = imageStates[whop.id];
                        if (!imageState || imageState.imageError || !imageState.imagePath || imageState.imagePath.trim() === '') {
                          return (
                            <div className="w-full h-full bg-gray-700 rounded-md flex items-center justify-center">
                              <span className="text-xs">{whop.name.charAt(0)}</span>
                            </div>
                          );
                        }
                        return (
                          <Image
                            src={imageState.imagePath}
                            alt={whop.name}
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                            style={{ maxWidth: '100%', maxHeight: '100%' }}
                            onError={() => handleImageError(whop.id, whop.name)}
                            unoptimized={imageState.imagePath.includes('@avif')}
                            sizes="32px"
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                          />
                        );
                      })()}
                    </div>
                    <span className="text-white">{whop.name}</span>
                  </div>
                </td>
                <td className="p-3 text-right text-white">{whop.totalActions}</td>
                <td className="p-3 text-right text-white">{whop.copies}</td>
                <td className="p-3 text-right text-white">{whop.clicks}</td>
                <td className="p-3 text-center">
                  <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchWhopDetails(whop.id);
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderActivityChart = () => {
    if (!data?.dailyActivity || data.dailyActivity.length === 0) {
      return <p className="text-gray-400 h-64 flex items-center justify-center">No activity data available</p>;
    }

    return (
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.dailyActivity}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#404055" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#a7a9b4' }}
              tickFormatter={(value) => {
                const date = new Date(value);
                // Format with abbreviated month and day only, with explicit timezone
                return date.toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'short',
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                });
              }}
            />
            <YAxis tick={{ fill: '#a7a9b4' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#2b2d36', borderColor: '#404055', color: '#fff' }}
              labelStyle={{ color: '#fff' }}
              formatter={(value: any) => [`${value}`, '']}
              labelFormatter={(label) => {
                // Use the standardized formatDateTime function
                return formatDateTime(label);
              }}
            />
            <Legend wrapperStyle={{ color: '#a7a9b4' }} />
            <Line 
              type="monotone" 
              dataKey="copies" 
              stroke="#3b82f6" 
              name="Code Copies" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="clicks" 
              stroke="#10b981" 
              name="Offer Clicks" 
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="#f59e0b" 
              name="Total Actions"
              strokeWidth={2} 
              dot={{ fill: '#f59e0b', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderActionType = (actionType: string) => {
    switch (actionType) {
      case "code_copy":
        return "Copied code";
      case "offer_click":
        return "Clicked offer";
      case "page_view":
        return "Viewed page";
      case "test":
        return "Test action";
      default:
        return actionType;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }) + ' - ' + date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const renderRecentActivity = () => {
    if (!data?.recentActivity || data.recentActivity.length === 0) {
      return <p className="text-gray-400">No recent activity available</p>;
    }

    // Calculate pagination values
    const totalItems = data.recentActivity.length;
    const totalPages = Math.ceil(totalItems / activityPageSize);
    const startIndex = (activityPage - 1) * activityPageSize;
    const endIndex = Math.min(startIndex + activityPageSize, totalItems);
    
    // Get current page items
    const displayedActivity = data.recentActivity.slice(startIndex, endIndex);

    return (
      <div className="space-y-3 mt-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm text-gray-400">
            Showing {startIndex + 1}-{endIndex} of {totalItems} events
          </div>
          <div className="flex items-center space-x-2">
            <select 
              className="bg-[#2b2d36] text-white text-sm p-1 rounded border border-[#444657]"
              value={activityPageSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value);
                setActivityPageSize(newSize);
                setActivityPage(1); // Reset to first page when changing page size
              }}
            >
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </div>

        {displayedActivity.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center justify-between bg-[#2b2d36] p-3 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 relative rounded-md overflow-hidden flex-shrink-0 bg-gray-800">
                {(() => {
                  const activityKey = `activity_${activity.id}`;
                  const imageState = imageStates[activityKey];
                  if (!imageState || imageState.imageError || !imageState.imagePath || imageState.imagePath.trim() === '') {
                    return (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center rounded-md">
                        <span className="text-xs">{activity.whopName.charAt(0)}</span>
                      </div>
                    );
                  }
                  return (
                    <Image
                      src={imageState.imagePath}
                      alt={activity.whopName}
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                      onError={() => handleImageError(activityKey, activity.whopName)}
                      unoptimized={imageState.imagePath.includes('@avif')}
                      sizes="40px"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                    />
                  );
                })()}
              </div>
              <div>
                <div className="text-white font-medium">{activity.whopName}</div>
                <div className="text-sm text-[#a7a9b4]">
                  {renderActionType(activity.actionType)}:
                  {activity.promoCode ? ` ${activity.promoCode}` : ` ${activity.promoTitle}`}
                </div>
              </div>
            </div>
            <div className="text-[#a7a9b4] text-sm">
              {formatDateTime(activity.createdAt)}
            </div>
          </div>
        ))}
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <button 
              onClick={() => setActivityPage(prev => Math.max(prev - 1, 1))}
              disabled={activityPage === 1}
              className={`px-3 py-1 rounded ${activityPage === 1 ? 'bg-[#2b2d36] text-gray-500' : 'bg-[#373946] hover:bg-[#444657] text-white'}`}
            >
              Previous
            </button>
            <div className="text-sm text-white">
              Page {activityPage} of {totalPages}
            </div>
            <button 
              onClick={() => setActivityPage(prev => Math.min(prev + 1, totalPages))}
              disabled={activityPage === totalPages}
              className={`px-3 py-1 rounded ${activityPage === totalPages ? 'bg-[#2b2d36] text-gray-500' : 'bg-[#373946] hover:bg-[#444657] text-white'}`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderWhopDetail = () => {
    if (!whopDetailData) return null;
    const whopDetails = whopDetailData.whopDetails;
    const bonuses = whopDetailData.bonusDetails;
    const analytics = whopDetailData.analytics;
    
    // Helper function to calculate percentage
    const calculatePercentage = (part: number, total: number) => {
      if (total === 0) return 0;
      return Math.round((part / total) * 100);
    };

    // Calculate pagination values for whop activity
    const totalWhopItems = analytics.recentActivity ? analytics.recentActivity.length : 0;
    const totalWhopPages = Math.ceil(totalWhopItems / whopActivityPageSize);
    const startWhopIndex = (whopActivityPage - 1) * whopActivityPageSize;
    const endWhopIndex = Math.min(startWhopIndex + whopActivityPageSize, totalWhopItems);
    
    // Get current page items for whop activity
    const displayedWhopActivity = analytics.recentActivity ? 
      analytics.recentActivity.slice(startWhopIndex, endWhopIndex) : [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setSelectedWhopId(null);
                setWhopDetailData(null);
                setVisibleActivityItems(DEFAULT_ACTIVITY_ITEMS);
                setVisibleWhopActivityItems(DEFAULT_ACTIVITY_ITEMS);
                setActivityPage(1);
                setWhopActivityPage(1);
              }}
              className="bg-[#373946] p-2 rounded-lg hover:bg-[#3c3f4a]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="bg-[#2b2d36] p-2 rounded-lg">
              <Image
                src={whopDetails.logo}
                alt={whopDetails.name}
                width={64}
                height={64}
                className="w-16 h-16 object-contain"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{whopDetails.name}</h3>
              <div className="text-[#a7a9b4] text-sm">
                Rating: {whopDetails.rating ? `${whopDetails.rating.toFixed(1)}/5` : '0.0/5'} | {whopDetails.website || "No website provided"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#2b2d36] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Total Actions</h4>
            <div className="text-3xl text-white font-bold">{analytics.totalActions}</div>
          </div>
          <div className="bg-[#2b2d36] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Copies</h4>
            <div className="text-3xl text-white font-bold">{analytics.totalCopies}</div>
          </div>
          <div className="bg-[#2b2d36] p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Clicks</h4>
            <div className="text-3xl text-white font-bold">{analytics.totalClicks}</div>
          </div>
        </div>

        {/* Recent Activity Section with same styling as main view - Moved above the chart */}
        <div className="bg-[#1e1f28] p-5 rounded-lg border border-[#343747]">
          <h4 className="text-xl font-semibold text-white mb-4">Recent Activity</h4>
          {analytics.recentActivity && analytics.recentActivity.length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm text-gray-400">
                  Showing {startWhopIndex + 1}-{endWhopIndex} of {totalWhopItems} events
                </div>
                <div className="flex items-center space-x-2">
                  <select 
                    className="bg-[#2b2d36] text-white text-sm p-1 rounded border border-[#444657]"
                    value={whopActivityPageSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value);
                      setWhopActivityPageSize(newSize);
                      setWhopActivityPage(1); // Reset to first page when changing page size
                    }}
                  >
                    <option value="5">5 per page</option>
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                    <option value="100">100 per page</option>
                  </select>
                </div>
              </div>
            
              {displayedWhopActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between bg-[#2b2d36] p-3 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 relative rounded-md overflow-hidden flex-shrink-0 bg-gray-800">
                      {(() => {
                        const whopKey = `whop_detail_${whopDetails.id || 'current'}`;
                        const imageState = imageStates[whopKey];
                        if (!imageState || imageState.imageError || !imageState.imagePath || imageState.imagePath.trim() === '') {
                          return (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center rounded-md">
                              <span className="text-xs">{whopDetails.name.charAt(0)}</span>
                            </div>
                          );
                        }
                        return (
                          <Image
                            src={imageState.imagePath}
                            alt={whopDetails.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-contain"
                            style={{ maxWidth: '100%', maxHeight: '100%' }}
                            onError={() => handleImageError(whopKey, whopDetails.name)}
                            unoptimized={imageState.imagePath.includes('@avif')}
                            sizes="40px"
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                          />
                        );
                      })()}
                    </div>
                    <div>
                      <div className="text-white font-medium">{whopDetails.name}</div>
                      <div className="text-sm text-[#a7a9b4]">
                        {renderActionType(activity.actionType)}:
                        {activity.promoCode ? ` ${activity.promoCode}` : ` ${activity.promoTitle}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-[#a7a9b4] text-sm">
                    {formatDateTime(activity.createdAt)}
                  </div>
                </div>
              ))}
              
              {/* Pagination controls for whop activity */}
              {totalWhopPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <button 
                    onClick={() => setWhopActivityPage(prev => Math.max(prev - 1, 1))}
                    disabled={whopActivityPage === 1}
                    className={`px-3 py-1 rounded ${whopActivityPage === 1 ? 'bg-[#2b2d36] text-gray-500' : 'bg-[#373946] hover:bg-[#444657] text-white'}`}
                  >
                    Previous
                  </button>
                  <div className="text-sm text-white">
                    Page {whopActivityPage} of {totalWhopPages}
                  </div>
                  <button 
                    onClick={() => setWhopActivityPage(prev => Math.min(prev + 1, totalWhopPages))}
                    disabled={whopActivityPage === totalWhopPages}
                    className={`px-3 py-1 rounded ${whopActivityPage === totalWhopPages ? 'bg-[#2b2d36] text-gray-500' : 'bg-[#373946] hover:bg-[#444657] text-white'}`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#a7a9b4]">No recent activity for this whop</p>
          )}
        </div>

        {/* Daily Activity section */}
        <div className="bg-[#2b2d36] p-4 rounded-lg">
          <h4 className="text-white font-medium mb-3">Daily Activity</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={analytics.dailyActivity}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#404055" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#a7a9b4' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    // Format with abbreviated month and day only, with explicit timezone
                    return date.toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'short',
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    });
                  }}
                />
                <YAxis tick={{ fill: '#a7a9b4' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#2b2d36', borderColor: '#404055', color: '#fff' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: any) => [`${value}`, '']}
                  labelFormatter={(label) => {
                    // Use the standardized formatDateTime function
                    return formatDateTime(label);
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#8884d8" 
                  name="Total" 
                  activeDot={{ r: 8 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="copies" 
                  stroke="#68D08B" 
                  name="Copies" 
                />
                <Line 
                  type="monotone" 
                  dataKey="clicks" 
                  stroke="#82ca9d" 
                  name="Clicks" 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex items-center space-x-4">
          <TimeframeSelector 
            value={timeframe} 
            onChange={handleTimeframeChange} 
            onCustomDateChange={handleCustomDateChange}
            startDate={customStartDate}
            endDate={customEndDate}
            resetCustomDates={resetCustomDates}
          />
          <div className="flex items-center space-x-2">
            <button 
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1"
              onClick={handleRefresh}
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M3 21v-5h5"></path>
              </svg>
              Refresh
            </button>
            <button 
              className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg flex items-center gap-1"
              onClick={handleWipeData}
              disabled={wipingData || loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Wipe Data
            </button>
          </div>
        </div>
      </div>
      
      {/* Show date range for custom timeframe */}
      {timeframe === 'custom' && (
        <div className="mb-4 text-sm text-white bg-[#2b2d36] p-2 rounded-lg inline-block">
          Viewing data from {customStartDate.toLocaleDateString('en-GB')} to {customEndDate.toLocaleDateString('en-GB')}
        </div>
      )}
      
      {lastRefreshed && (
        <div className="text-xs text-gray-400 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg> 
          Last updated: {formatDateTime(lastRefreshed.toString())}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : selectedWhopId && whopDetailData ? (
        renderWhopDetail()
      ) : (
        <div className="space-y-6">
          {renderOverviewStats()}
          
          {/* Recent Activity Section - Moved above the chart */}
          <div className="bg-[#1e1f28] p-5 rounded-lg border border-[#343747]">
            <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
            {renderRecentActivity()}
          </div>
          
          {/* Activity Over Time Section */}
          <div className="bg-[#1e1f28] p-5 rounded-lg border border-[#343747]">
            <h2 className="text-xl font-semibold text-white mb-4">Activity Over Time</h2>
            {renderActivityChart()}
          </div>
          
          {/* Performance Section */}
          <div className="bg-[#1e1f28] p-5 rounded-lg border border-[#343747]">
            <h2 className="text-xl font-semibold text-white mb-4">Performance</h2>
            {renderWhopTable()}
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
} 