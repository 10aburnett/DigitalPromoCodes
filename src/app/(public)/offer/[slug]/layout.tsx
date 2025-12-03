import type { ReactNode } from "react";

export default function WhopDetailLayout({
  children,
  types,
  etypes,
}: {
  children: ReactNode;
  types?: ReactNode;
  etypes?: ReactNode;
}) {
  // Mobile-only pull up under the fixed header; desktop unchanged
  return (
    <div className="-mt-12 md:mt-0">
      {children}
      {types}
      {etypes}
    </div>
  );
}