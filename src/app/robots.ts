// Phase 2: Block all crawling for domain deindexing
// noindex tags from Phase 1 are still in place for consistency

export default function robots() {
  return {
    rules: [
      { userAgent: '*', disallow: '/' },
    ],
    // No sitemap during deindexing
  };
}
