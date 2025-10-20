// SSR-safe logo component that works without JavaScript
export function WhopLogoSSR({
  src = '',
  alt,
  width = 56,
  height = 56
}: {
  src?: string;
  alt: string;
  width?: number;
  height?: number;
}) {
  // For relative paths (starting with /), serve directly from public folder
  // For absolute URLs (http/https), proxy through /api/img for security & caching
  const isAbsoluteUrl = src.startsWith('http://') || src.startsWith('https://');
  const safe = isAbsoluteUrl
    ? `/api/img?src=${encodeURIComponent(src)}`
    : src; // Serve directly from /public

  return (
    <>
      <img
        src={safe}
        alt={alt}
        width={width}
        height={height}
        loading="eager"
        decoding="async"
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      />
      <noscript>
        <img src={safe} alt={alt} width={width} height={height} />
      </noscript>
    </>
  );
}
