/** @type {import('next').NextConfig} */
const isNuclear = process.env.NUCLEAR_TS_IGNORE === '1';

module.exports = {
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    localeDetection: false
  },
  // Ensure these toggles are actually respected
  typescript: { ignoreBuildErrors: isNuclear },
  eslint: { ignoreDuringBuilds: isNuclear },

  // No basePath, no assetPrefix, no rewrites, no headers, no redirects
  async rewrites() { return []; },
  async redirects() { return []; },
  async headers() { return []; },

  // Avoid plugin wrappers here (bundle analyzer, sentry, etc.)
};