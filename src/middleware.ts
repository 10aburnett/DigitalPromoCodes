import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RETIRED_PATHS, NOINDEX_PATHS } from './app/_generated/seo-indexes';

// Simple JWT verification for Edge Runtime
function verifyJWT(token: string, secret: string): any {
  try {
    // Split the JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode the payload (we'll skip signature verification for middleware)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check if token has expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Middleware that handles admin routes, API routes, and SEO
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow all debug routes and trace route to pass through untouched
  if (pathname.startsWith('/api/_debug/') || pathname.startsWith('/api/debug-api/') || pathname.startsWith('/api/_trace')) {
    return NextResponse.next();
  }

  if (process.env.SKIP_SEO_BUILD === '1') {
    const res = NextResponse.next();
    res.headers.set('x-skip-seo', '1');
    return res;
  }
  const url = request.nextUrl;
  const path = url.pathname.replace(/\/+$/, '');

  // Skip static and public assets - NEVER apply middleware to these
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/public/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/data/pages/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/site.webmanifest' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/sitemaps/') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  // ========================================
  // PRODUCTION MODE: Normal SEO handling for DigitalPromoCodes
  // ========================================

  // SEO LOGIC FIRST (for offer routes - renamed from whop)
  if (path.startsWith('/offer/') || path.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\/offer\//)) {
    // prove middleware executed (dev only)
    const res = NextResponse.next();
    if (process.env.NODE_ENV !== 'production') res.headers.set('x-mw-hit', '1');

    // 1) CASE + COLON NORMALIZATION: Canonicalize /offer/* paths
    if (path.startsWith('/offer/')) {
      let target = path.toLowerCase();

      // Canonicalize colon variants:
      // - literal ":" → "%3a"
      // - "%3A" → "%3a"
      if (target.includes(':')) {
        target = target.replace(/:/g, '%3a');
      }
      if (/%3a/i.test(target)) {
        target = target.replace(/%3a/gi, '%3a');
      }

      if (target !== path) {
        // Create new URL with canonical path while preserving query params and hash
        const newUrl = url.clone();
        newUrl.pathname = target;
        return NextResponse.redirect(newUrl, 301);
      }
    }

    // 2) normalize legacy locale URLs → /offer/:slug
    const m = path.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\/offer\/(.+)$/);
    if (m) {
      return NextResponse.redirect(new URL(`/offer/${m[2]}`, url), 308);
    }

    // 3) handle specific redirects (preserve existing)
    if (path === '/offer/monthly-mentorship') {
      return NextResponse.redirect(new URL('/offer/ayecon-academy-monthly-mentorship', url));
    }

    // 4) exact 410 for retired
    if (RETIRED_PATHS.has(path)) {
      return new NextResponse('Gone', {
        status: 410,
        headers: {
          ...(process.env.NODE_ENV !== 'production' ? {'x-mw-hit':'1'} : {}),
          'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
          'X-Robots-Tag': 'noindex'
        }
      });
    }

    // 5) X-Robots-Tag for NOINDEX paths only
    if (NOINDEX_PATHS.has(path)) {
      res.headers.set('X-Robots-Tag', 'noindex, follow');
    }

    // 6) fall through to admin/API logic if needed, or return
    if (!path.startsWith('/admin') && !path.startsWith('/api')) {
      return res;
    }
  }

  // Legacy /whop/ redirect to /offer/
  if (path.startsWith('/whop/')) {
    const newPath = path.replace('/whop/', '/offer/');
    return NextResponse.redirect(new URL(newPath, url), 301);
  }
  
  // Handle preflight OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    response.headers.append('Access-Control-Allow-Credentials', 'true');
    response.headers.append('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
    response.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
    response.headers.append('Access-Control-Allow-Headers', 
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    
    return response;
  }
  
  // Create response
  const response = NextResponse.next();

  // Add CORS headers for API routes
  if (pathname.startsWith('/api')) {
    response.headers.append('Access-Control-Allow-Credentials', 'true');
    response.headers.append('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
    response.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
    response.headers.append(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
    
    // For API routes that require admin authentication
    if (
      (pathname.includes('/api/casinos') || 
       pathname.includes('/api/bonuses') || 
       pathname.includes('/api/reviews') ||
       pathname.includes('/api/analytics/wipe') ||
       pathname.includes('/api/settings') ||
       pathname.includes('/api/upload')) && 
      (request.method === 'POST' || 
       request.method === 'PUT' || 
       request.method === 'DELETE')
    ) {
      // Skip this check for public endpoints
      if (pathname !== '/api/reviews' && !pathname.startsWith('/api/reviews/submit')) {
        // Get admin-token from cookies
        const token = request.cookies.get('admin-token');
        
        // Return unauthorized if no token found
        if (!token) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized' }),
            { 
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
                'Access-Control-Allow-Credentials': 'true'
              }
            }
          );
        }
      }
    }
    
    return response;
  }
  
  // Skip middleware for login page
  if (pathname === '/admin/login') {
    return response;
  }
  
  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    // Add noindex header for all admin routes (defense-in-depth)
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');

    // Get admin-token from cookies
    const token = request.cookies.get('admin-token')?.value;

    // Redirect to login if no token found
    if (!token) {
      console.log('No admin token found, redirecting to login');
      const redirectResponse = NextResponse.redirect(new URL('/admin/login', request.url));
      redirectResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return redirectResponse;
    }
    
    try {
      const decoded = verifyJWT(token, process.env.AUTH_SECRET || 'whpcodes-secret-key');
      
      // Check if user has admin role
      if (decoded.role !== 'ADMIN') {
        console.log('User does not have admin role, redirecting to login');
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
      
    } catch (error) {
      console.log('Token verification failed, redirecting to login:', error.message);
      const redirectResponse = NextResponse.redirect(new URL('/admin/login', request.url));
      // Clear the invalid token
      redirectResponse.cookies.set('admin-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
      });
      return redirectResponse;
    }
  }

  return response;
}

// Configure the paths that middleware should run on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ]
}; 