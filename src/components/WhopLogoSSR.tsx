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
  const safe = `/api/img?src=${encodeURIComponent(src || '')}`;

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
