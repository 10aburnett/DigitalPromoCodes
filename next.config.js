/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: false, // Enable image optimization
    domains: ['cdn.prod.website-files.com', 'localhost'],
    remotePatterns: [
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
  // Rewrites for data directory
  async rewrites() {
    return [
      {
        source: '/data/:path*',
        destination: '/api/data/:path*',
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