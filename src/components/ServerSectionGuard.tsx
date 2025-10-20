// ServerSectionGuard.tsx
export default function ServerSectionGuard({
  children,
  label,
}: { children: React.ReactNode; label: string }) {
  try {
    return <>{children}</>;
  } catch (e) {
    console.error(`[ServerSectionGuard:${label}]`, e);
    return null;
  }
}
