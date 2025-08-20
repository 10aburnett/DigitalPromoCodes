import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RETIRED_PATHS, NOINDEX_PATHS } from './src/app/_generated/seo-indexes';

// Define the language codes
const languageKeys = ['en', 'es', 'nl', 'fr', 'de', 'it', 'pt', 'zh'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Locale prefix normalizer: /en/whop/foo -> /whop/foo
  const path = request.nextUrl.pathname.replace(/\/+$/, '');
  const m = path.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)\/whop\/(.+)$/);
  if (m) {
    const dest = new URL(`/whop/${m[2]}`, request.url);
    // 308 keeps method; good for SEO "permanent" semantics
    return NextResponse.redirect(dest, 308);
  }
  
  // SEO: Handle retired pages with 410 Gone
  const normalizedPath = pathname.replace(/\/+$/, ''); // normalize trailing slash
  if (RETIRED_PATHS.has(normalizedPath)) {
    return new NextResponse('Gone', { 
      status: 410,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
      }
    });
  }

  // SEO: Add X-Robots-Tag for NOINDEX pages (belt-and-braces)
  if (NOINDEX_PATHS.has(normalizedPath)) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
  }
  
  // Handle specific redirects
  if (pathname === '/whop/monthly-mentorship') {
    return NextResponse.redirect(new URL('/whop/ayecon-academy-monthly-mentorship', request.url));
  }
  
  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') ||
    pathname.startsWith('/admin/')
  ) {
    return NextResponse.next();
  }

  // Handle root path
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Extract the first segment
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  // Handle specific routes that should not be treated as locales
  if (firstSegment === 'whop' || firstSegment === 'contact' || firstSegment === 'terms' || firstSegment === 'privacy') {
    return NextResponse.next();
  }

  // If the first segment is a language code (and not 'en'), treat it as a locale route
  if (languageKeys.includes(firstSegment) && firstSegment !== 'en') {
    return NextResponse.next();
  }

  // For any other route that's not a language code, let Next.js handle it normally
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 