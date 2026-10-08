import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'; // Explicitly mark this route as dynamic
export const revalidate = 0; // Never cache the result
export const maxDuration = 30; // Reduced from 60 to 30 seconds for better UX

// Which site an event came from. Every site sharing this DB (whoppromocodes.com,
// membersdealsclub.com, promodrop.codes) records the page URL in `path`.
function siteOf(path: string | null): string {
  if (!path) return 'unknown';
  try { return new URL(path).hostname.replace(/^www\./, '') || 'unknown'; } catch { return 'unknown'; }
}

function siteBreakdownOf(rows: { site: string; actionType: string }[]) {
  const m = new Map<string, { site: string; total: number; copies: number; clicks: number }>();
  for (const r of rows) {
    const s = m.get(r.site) || { site: r.site, total: 0, copies: 0, clicks: 0 };
    s.total += 1;
    if (r.actionType === 'code_copy') s.copies += 1;
    else if (r.actionType === 'offer_click') s.clicks += 1;
    m.set(r.site, s);
  }
  return Array.from(m.values()).sort((a, b) => b.total - a.total);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '7days';
    const whopId = searchParams.get('whopId') || null;
    const forceRefresh = searchParams.get('refresh') === 'true';
    const debug = searchParams.get('debug') === 'true';
    const site = searchParams.get('site') || null; // filter to one site (hostname), null = all
    
    // Get custom date range parameters if present
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    // Get the current timezone offset in minutes
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    const timezoneOffsetMs = timezoneOffsetMinutes * 60 * 1000;
    const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    console.log(`Current timezone: ${clientTimezone}`);
    console.log(`Timezone offset: ${timezoneOffsetMinutes} minutes (${timezoneOffsetMs} ms)`);
    
    // Debug mode - return raw data without processing
    if (debug) {
      const rawData = await prisma.offerTracking.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      });
      return NextResponse.json(rawData);
    }

    // Calculate date range based on timeframe
    const currentDate = new Date();
    let startDate = new Date();
    
    // If custom date range is provided, use it
    if (timeframe === 'custom' && startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      // For end date, set time to end of day to include the entire day
      currentDate.setTime(new Date(endDateParam).getTime());
      currentDate.setHours(23, 59, 59, 999);
      
      console.log(`Using custom date range: ${startDate.toISOString()} to ${currentDate.toISOString()}`);
    } else {
      // Adjust the start date based on the selected timeframe
      switch (timeframe) {
        case 'today':
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
          break;
        case 'yesterday':
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1);
          currentDate.setDate(currentDate.getDate() - 1);
          currentDate.setHours(23, 59, 59, 999);
          break;
        case '7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'alltime':
          // Instead of beginning of time, use a reasonable limit (e.g., 1 year ago)
          // to prevent performance issues with very large datasets
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7); // Default to 7 days
      }
    }
    
    // Apply timezone offset to make sure we're getting the right dates in local time
    // The database might store dates in UTC, but we want to filter based on local time
    const startDateUTC = new Date(startDate.getTime() - (timezoneOffsetMinutes * 60000));
    const currentDateUTC = new Date(currentDate.getTime() - (timezoneOffsetMinutes * 60000));
    
    // Base query conditions
    const where = {
      createdAt: {
        gte: startDateUTC,
        lte: currentDateUTC
      }
    };
    
    // If we're getting data for a specific whop, add that condition
    if (whopId) {
      // For single whop view
      const whop = await prisma.deal.findUnique({
        where: { id: whopId },
        include: {
          PromoCode: true
        }
      });
      
      if (!whop) {
        return NextResponse.json({ error: "Whop not found" }, { status: 404 });
      }
      
      // Get tracking data for this whop within the timeframe with reasonable limits
      const isAllTime = timeframe === 'alltime';
      const trackingLimit = isAllTime ? 5000 : undefined; // Limit to 5k records for all-time whop view
      
      const trackings = await prisma.offerTracking.findMany({
        where: {
          ...where,
          whopId: whopId
        },
        orderBy: {
          createdAt: 'desc'
        },
        ...(trackingLimit && { take: trackingLimit })
      });
      
      // Process trackings data to get statistics
      const allTrackings = trackings.map(tracking => ({
        id: tracking.id,
        site: siteOf(tracking.path),
        offerId: tracking.whopId,
        promoCodeId: tracking.promoCodeId,
        actionType: tracking.actionType,
        createdAt: tracking.createdAt,
        whopName: whop.name,
        whopSlug: whop.slug,
        whopLogo: whop.logo,
        promoTitle: whop.PromoCode.find(p => p.id === tracking.promoCodeId)?.title || "Unknown Promo",
        promoCode: whop.PromoCode.find(p => p.id === tracking.promoCodeId)?.code || null
      }));
      const siteBreakdown = siteBreakdownOf(allTrackings);
      const transformedTrackings = site ? allTrackings.filter(t => t.site === site) : allTrackings;
      
      // Organize data by date for the chart
      const dailyActivityMap = new Map();
      
      // For "alltime", only initialize dates that have actual data to prevent memory issues
      // For other timeframes, initialize the full range
      if (timeframe === 'alltime') {
        // Only create entries for dates that have actual tracking data
        transformedTrackings.forEach(tracking => {
          const date = new Date(tracking.createdAt);
          const dateString = date.toISOString().split('T')[0];
          if (!dailyActivityMap.has(dateString)) {
            dailyActivityMap.set(dateString, { date: dateString, copies: 0, clicks: 0, total: 0 });
          }
        });
      } else {
        // Initialize with dates in the selected range for other timeframes
        const currentDay = new Date(startDate);
        while (currentDay <= currentDate) {
          const dateString = currentDay.toISOString().split('T')[0];
          dailyActivityMap.set(dateString, { date: dateString, copies: 0, clicks: 0, total: 0 });
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
      
      // Populate with actual data
      transformedTrackings.forEach(tracking => {
        const date = new Date(tracking.createdAt);
        const dateString = date.toISOString().split('T')[0];
        
        if (!dailyActivityMap.has(dateString)) {
          dailyActivityMap.set(dateString, { date: dateString, copies: 0, clicks: 0, total: 0 });
        }
        
        const dayData = dailyActivityMap.get(dateString);
        
        if (tracking.actionType === 'code_copy') {
          dayData.copies += 1;
        } else if (tracking.actionType === 'offer_click') {
          dayData.clicks += 1;
        }
        
        dayData.total += 1;
      });
      
      // Convert Map to array and sort by date
      const dailyActivity = Array.from(dailyActivityMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Calculate totals
      const totalActions = transformedTrackings.length;
      const totalCopies = transformedTrackings.filter(t => t.actionType === 'code_copy').length;
      const totalClicks = transformedTrackings.filter(t => t.actionType === 'offer_click').length;
      
      // For single whop view
      return NextResponse.json({
        offerDetails: {
          id: whop.id,
          name: whop.name,
          slug: whop.slug,
          logo: whop.logo,
          description: whop.description,
          rating: whop.rating
        },
        promoDetails: whop.PromoCode.map(promo => ({
          id: promo.id,
          title: promo.title,
          code: promo.code,
          type: promo.type,
          value: promo.value,
          copies: transformedTrackings.filter(t => t.promoCodeId === promo.id && t.actionType === "code_copy").length,
          clicks: transformedTrackings.filter(t => t.promoCodeId === promo.id && t.actionType === "offer_click").length
        })),
        siteBreakdown,
        analytics: {
          totalActions,
          totalCopies,
          totalClicks,
          dailyActivity,
          recentActivity: transformedTrackings
        }
      });
    } else {
      // For overall analytics dashboard
      
      // Get all whops
      const whops = await prisma.deal.findMany({
        include: {
          PromoCode: true
        }
      });
      
      // Get tracking data within the timeframe with reasonable limits
      // For "alltime", limit to prevent performance issues
      const isAllTime = timeframe === 'alltime';
      const trackingLimit = isAllTime ? 10000 : undefined; // Limit to 10k records for all-time
      
      console.log("📊 ANALYTICS API: Fetching tracking data with:", {
        timeframe,
        startDateUTC: startDateUTC.toISOString(),
        currentDateUTC: currentDateUTC.toISOString(),
        trackingLimit
      });
      
      const trackings = await prisma.offerTracking.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        ...(trackingLimit && { take: trackingLimit })
      });
      
      console.log("📊 ANALYTICS API: Found", trackings.length, "tracking records");
      
      if (trackings.length > 0) {
        console.log("📊 ANALYTICS API: First tracking record:", {
          id: trackings[0].id,
          offerId: trackings[0].whopId,
          promoCodeId: trackings[0].promoCodeId,
          actionType: trackings[0].actionType,
          createdAt: trackings[0].createdAt
        });
      }
      
      // Process trackings data to get statistics for overall analytics dashboard
      const allTrackings = trackings.map(tracking => {
        const whop = whops.find(w => w.id === tracking.whopId);
        const promo = whop?.PromoCode.find(p => p.id === tracking.promoCodeId);
        
        return {
          id: tracking.id,
          site: siteOf(tracking.path),
          offerId: tracking.whopId,
          promoCodeId: tracking.promoCodeId,
          actionType: tracking.actionType,
          createdAt: tracking.createdAt,
          whopName: whop?.name || "Unknown Whop",
          whopSlug: whop?.slug || "",
          whopLogo: whop?.logo || "",
          promoTitle: promo?.title || "Unknown Promo",
          promoCode: promo?.code || null
        };
      });
      const siteBreakdown = siteBreakdownOf(allTrackings);
      const transformedTrackings = site ? allTrackings.filter(t => t.site === site) : allTrackings;
      
      // Calculate whop-specific analytics
      const whopAnalytics = whops.map(whop => {
        const whopTrackings = transformedTrackings.filter(t => t.offerId === whop.id);
        const totalActions = whopTrackings.length;
        const copies = whopTrackings.filter(t => t.actionType === 'code_copy').length;
        const clicks = whopTrackings.filter(t => t.actionType === 'offer_click').length;
        
        return {
          id: whop.id,
          name: whop.name,
          slug: whop.slug,
          logo: whop.logo,
          totalActions,
          copies,
          clicks,
          promoCodes: whop.PromoCode.map(promo => ({
            id: promo.id,
            title: promo.title,
            code: promo.code,
            type: promo.type,
            value: promo.value,
            copies: whopTrackings.filter(t => t.promoCodeId === promo.id && t.actionType === "code_copy").length,
            clicks: whopTrackings.filter(t => t.promoCodeId === promo.id && t.actionType === "offer_click").length
          }))
        };
      }).sort((a, b) => b.totalActions - a.totalActions); // Sort by most actions
      
      // Organize data by date for the chart
      const dailyActivityMap = new Map();
      
      // For "alltime", only initialize dates that have actual data to prevent memory issues
      // For other timeframes, initialize the full range
      if (timeframe === 'alltime') {
        // Only create entries for dates that have actual tracking data
        transformedTrackings.forEach(tracking => {
          const date = new Date(tracking.createdAt);
          const dateString = date.toISOString().split('T')[0];
          if (!dailyActivityMap.has(dateString)) {
            dailyActivityMap.set(dateString, { date: dateString, copies: 0, clicks: 0, total: 0 });
          }
        });
      } else {
        // Initialize with dates in the selected range for other timeframes
        const currentDay = new Date(startDate);
        while (currentDay <= currentDate) {
          const dateString = currentDay.toISOString().split('T')[0];
          dailyActivityMap.set(dateString, { date: dateString, copies: 0, clicks: 0, total: 0 });
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
      
      // Populate with actual data
      transformedTrackings.forEach(tracking => {
        const date = new Date(tracking.createdAt);
        const dateString = date.toISOString().split('T')[0];
        
        if (!dailyActivityMap.has(dateString)) {
          dailyActivityMap.set(dateString, { date: dateString, copies: 0, clicks: 0, total: 0 });
        }
        
        const dayData = dailyActivityMap.get(dateString);
        
        if (tracking.actionType === 'code_copy') {
          dayData.copies += 1;
        } else if (tracking.actionType === 'offer_click') {
          dayData.clicks += 1;
        }
        
        dayData.total += 1;
      });
      
      // Convert Map to array and sort by date
      const dailyActivity = Array.from(dailyActivityMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Calculate totals
      const totalActions = transformedTrackings.length;
      const totalCopies = transformedTrackings.filter(t => t.actionType === 'code_copy').length;
      const totalClicks = transformedTrackings.filter(t => t.actionType === 'offer_click').length;
      
      // For overall dashboard
      return NextResponse.json({
        overall: {
          totalActions,
          totalCopies,
          totalClicks
        },
        siteBreakdown,
        whopAnalytics,
        dailyActivity,
        recentActivity: transformedTrackings
      });
    }
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
  }
} 