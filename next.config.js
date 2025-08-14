/** @type {import('next').NextConfig} */
const nextConfig = {
  // DO NOT set assetPrefix or basePath while debugging
  assetPrefix: undefined,
  basePath: "",

  // If you want built-in i18n later, keep it OFF for the baseline
  // i18n: undefined,

  images: { unoptimized: false },
  trailingSlash: false,
  experimental: { appDir: true },
};

module.exports = nextConfig;