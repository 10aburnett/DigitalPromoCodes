/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { appDir: true },
  i18n: {
    locales: ["en", "es", "nl", "fr", "de", "it", "pt", "zh"],
    defaultLocale: "en",
    localeDetection: false
  },
  // No assetPrefix/basePath
  eslint: { ignoreDuringBuilds: true },     // keep while stabilising
  typescript: { ignoreBuildErrors: true }   // keep while stabilising
};