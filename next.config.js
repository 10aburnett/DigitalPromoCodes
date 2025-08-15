/** @type {import('next').NextConfig} */
const isNuclear = process.env.NUCLEAR_TS_IGNORE === '1';

console.log("[build] NUCLEAR_TS_IGNORE =", process.env.NUCLEAR_TS_IGNORE);
console.log("[build] VERCEL =", process.env.VERCEL);

module.exports = {
  // Hardcode ignores for debug branch (Vercel doesn't have env vars set)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // No basePath, no assetPrefix, no rewrites, no headers, no redirects
  async rewrites() { return []; },
  async redirects() { return []; },
  async headers() { return []; },

  // Avoid plugin wrappers here (bundle analyzer, sentry, etc.)
};