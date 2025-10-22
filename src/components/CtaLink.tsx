// src/components/CtaLink.tsx (server-safe)
import 'server-only';

export default function CtaLink({
  href,
  className = '',
  children,
  title,
  ariaLabel,
}: {
  href?: string | null;
  className?: string;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const hasHref = !!href;
  return (
    <a
      href={hasHref ? href! : '#'}
      className={className}
      title={title}
      aria-label={ariaLabel}
      aria-disabled={!hasHref}
      tabIndex={hasHref ? 0 : -1}
      style={hasHref ? undefined : { pointerEvents: 'none', opacity: 0.6 }}
    >
      {children}
    </a>
  );
}