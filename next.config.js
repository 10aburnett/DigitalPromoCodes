/** @type {import('next').NextConfig} */
const isNuclear = process.env.NUCLEAR_TS_IGNORE === '1';

const nextConfig = {
  // DO NOT set assetPrefix or basePath while debugging
  assetPrefix: undefined,
  basePath: "",

  // If you want built-in i18n later, keep it OFF for the baseline
  // i18n: undefined,

  images: { unoptimized: false },
  trailingSlash: false,
  experimental: { appDir: true },
  
  typescript: {
    // Only ignore TS errors when explicitly told to
    ignoreBuildErrors: isNuclear,
  },
  eslint: {
    // Only skip ESLint during builds when explicitly told to
    ignoreDuringBuilds: isNuclear,
  },
};

module.exports = nextConfig;