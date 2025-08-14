import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define the supported locales (en is default/unprefixed)
const LOCALES = ['es', 'nl', 'fr', 'de', 'it', 'pt', 'zh'];

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

// Handle admin authentication logic
function handleAdminAuth(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
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
  
  // Skip middleware for login page
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }
  
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
  
  return NextResponse.next();
}

// Handle API routes with CORS
function handleApiRoutes(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
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
  
  // Create response with CORS headers
  const response = NextResponse.next();
  response.headers.append('Access-Control-Allow-Credentials', 'true');
  response.headers.append('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
  response.headers.append('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
  response.headers.append('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // For admin API routes that require authentication
  if ((pathname.includes('/api/casinos') || 
       pathname.includes('/api/bonuses') || 
       pathname.includes('/api/reviews') ||
       pathname.includes('/api/analytics/wipe') ||
       pathname.includes('/api/settings') ||
       pathname.includes('/api/upload')) && 
      (request.method === 'POST' || 
       request.method === 'PUT' || 
       request.method === 'DELETE')) {
    
    // Skip auth check for public endpoints
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

// Main middleware function - rewrite locale routes to use [locale] structure
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // === API ROUTE HANDLING ===
  if (pathname.startsWith('/api/')) {
    return handleApiRoutes(request);
  }
  
  // === SPECIFIC REDIRECTS ===
  if (pathname === '/whop/monthly-mentorship') {
    return NextResponse.redirect(new URL('/whop/ayecon-academy-monthly-mentorship', request.url));
  }
  
  // === ADMIN AUTH LOGIC (isolated from i18n) ===
  if (pathname.startsWith('/admin')) {
    return handleAdminAuth(request);
  }
  
  // === LOCALIZED ROUTE REWRITING ===
  const localeMatch = pathname.match(/^\/(es|nl|fr|de|it|pt|zh)(?:\/(.*))?$/);
  if (localeMatch) {
    const locale = localeMatch[1];
    const pathAfterLocale = localeMatch[2] || '';
    
    // Rewrite to the [locale] dynamic route structure
    const newUrl = new URL(request.url);
    newUrl.pathname = `/${locale}/${pathAfterLocale}`;
    
    const response = NextResponse.rewrite(newUrl);
    response.cookies.set('locale', locale, { path: '/' });
    return response;
  }
  
  // === ROOT PATH DETECTION ===
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Fall-through: English routes and other paths, no-op
  return NextResponse.next();
}

// Fix for Vercel production locale asset issues
export const config = {
  matcher: [
    // Match all routes but handle static assets specially
    '/((?!_next/static|_next/image|favicon|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2|ttf|eot)).*)',
  ],
};