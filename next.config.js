/** @type {import('next').NextConfig} */
const isNuclear = process.env.NUCLEAR_TS_IGNORE === '1';

console.log("[build] NUCLEAR_TS_IGNORE =", process.env.NUCLEAR_TS_IGNORE);
console.log("[build] VERCEL =", process.env.VERCEL);

module.exports = {
  // Hardcode ignores for debug branch (Vercel doesn't have env vars set)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Ensure static assets are served from root, not localized paths
  assetPrefix: '',
  
  // Rewrite static assets to bypass locale prefixing
  async rewrites() { 
    return [
      // Serve static assets from root regardless of locale
      {
        source: '/:locale(en|es)/_next/static/:path*',
        destination: '/_next/static/:path*'
      },
      // Also handle API routes and other static files
      {
        source: '/:locale(en|es)/api/:path*',
        destination: '/api/:path*'
      },
      {
        source: '/:locale(en|es)/favicon.ico',
        destination: '/favicon.ico'
      }
    ];
  },
  async redirects() { return []; },
  async headers() { return []; },

  // Avoid plugin wrappers here (bundle analyzer, sentry, etc.)
};