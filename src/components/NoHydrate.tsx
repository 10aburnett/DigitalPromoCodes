'use client';

export default function NoHydrate({
  html,
  className,
}: { html: string; className?: string }) {
  // Tell React: don't try to reconcile children under here
  // We also don't render any children on the client.
  return (
    <div
      className={className}
      suppressHydrationWarning
      // On the client this div is left as-is (no children rendered),
      // so the server HTML remains in the DOM untouched.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}