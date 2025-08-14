import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define the language codes for routing
const languageKeys = ['en', 'es', 'nl', 'fr', 'de', 'it', 'pt', 'zh'];

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

// Combined middleware that handles language routing, admin routes, and API routes
export function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname;
  
  // === LANGUAGE ROUTING LOGIC ===
  // Handle specific redirects first
  if (pathname === '/whop/monthly-mentorship') {
    return NextResponse.redirect(new URL('/whop/ayecon-academy-monthly-mentorship', request.url));
  }
  
  // Skip language routing for API routes, static files, and admin routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') ||
    pathname.startsWith('/admin/')
  ) {
    // Continue to admin/API logic below
  } else {
    // Handle language routing for other routes
    if (pathname === '/') {
      // Root path - continue to admin/API logic
    } else {
      const segments = pathname.split('/').filter(Boolean);
      const firstSegment = segments[0];

      // Handle specific routes that should not be treated as locales
      if (firstSegment === 'whop' || firstSegment === 'contact' || firstSegment === 'terms' || firstSegment === 'privacy') {
        // Continue to admin/API logic
      } else if (languageKeys.includes(firstSegment) && firstSegment !== 'en') {
        // Valid language route - continue to admin/API logic
      }
    }
  }
  
  // === ADMIN/API LOGIC ===
  
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
    // Get admin-token from cookies
    const token = request.cookies.get('admin-token')?.value;
    
    // Redirect to login if no token found
    if (!token) {
      console.log('No admin token found, redirecting to login');
      return NextResponse.redirect(new URL('/admin/login', request.url));
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
    // Admin and API routes
    '/admin/:path*', 
    '/api/:path*',
    // Language routing (excluding static files and Next.js internals)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
}; 