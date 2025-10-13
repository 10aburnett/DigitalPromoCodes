/** @type {import('next').NextConfig} */

// Asset origin for proxying uploads in dev
const ASSET_ORIGIN = process.env.ASSET_ORIGIN || 'https://whpcodes.com';

const nextConfig = {
  images: {
    unoptimized: false, // Enable image optimization
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'whpcodes.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.prod.website-files.com',
      },
      // Common CDN hosts for whop logos
      {
        protocol: 'https',
        hostname: 'cdn.whop.com',
      },
      {
        protocol: 'https',
        hostname: 'static.whop.xyz',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
      },
      // Wildcard for any other https images
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Image optimization settings
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  trailingSlash: false,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    largePageDataBytes: 5 * 1024 * 1024, // 5MB
    optimizePackageImports: ['recharts', 'react-beautiful-dnd', '@heroicons/react'],
  },
  typescript: {
    // !! WARN !!
    // Temporarily ignore TypeScript errors
    // Remove this when Prisma Client is properly regenerated
    ignoreBuildErrors: true,
  },
  // Disable React strict mode to avoid double renders in development
  // This helps react-beautiful-dnd work properly in development
  reactStrictMode: false,
  // Bundle optimization for better performance
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    styledComponents: false,
    // Optimize for modern browsers
    emotion: false,
  },
  // Modern JavaScript output with optimized transpilation
  swcMinify: true,
  // Remove unused code in production
  modularizeImports: {
    '@heroicons/react/24/outline': {
      transform: '@heroicons/react/24/outline/{{member}}',
    },
    '@heroicons/react/24/solid': {
      transform: '@heroicons/react/24/solid/{{member}}',
    },
    'recharts': {
      transform: 'recharts/lib/{{member}}',
    },
    'react-beautiful-dnd': {
      transform: 'react-beautiful-dnd/{{member}}',
    },
  },
  // Custom headers for sitemap files
  async headers() {
    return [
      // Allow ISR caching for whop pages
      {
        source: '/whop/:slug',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // Allow ISR caching for homepage
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // Strong caching for Next.js static assets
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Strong caching for Next.js image optimization
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Keep APIs private
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'max-age=0, s-maxage=0, must-revalidate' },
        ],
      },
      {
        source: '/sitemaps/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'max-age=0, s-maxage=0, must-revalidate' },
        ],
      },
      {
        source: '/data/graph/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=60' }, // 1 minute for graph files
        ],
      },
      {
        source: '/data/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'max-age=300, s-maxage=300' }, // 5 minutes
        ],
      },
      {
        source: "/data/pages/:path*.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, s-maxage=60, stale-while-revalidate=86400" }
        ]
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  // Rewrites for data directory and asset proxying
  async rewrites() {
    return [
      {
        source: '/data/:path*',
        destination: '/api/data/:path*',
      },
      // Proxy /uploads to production in dev (for DB logo paths)
      {
        source: '/uploads/:path*',
        destination: `${ASSET_ORIGIN}/uploads/:path*`,
      },
    ];
  },
  // Temporarily disable custom webpack config to fix chunk loading issues
  // webpack: (config, { dev, isServer }) => {
  //   // Custom webpack config disabled until chunk naming is resolved
  //   return config;
  // },
};

module.exports = nextConfig;