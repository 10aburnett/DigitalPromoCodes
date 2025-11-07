import type { ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
  types?: ReactNode;
  etypes?: ReactNode;
};

export default function WhopDetailLayout({
  children,
  types,
  etypes,
}: LayoutProps) {
  // Mobile-only pull up under the fixed header; desktop unchanged
  return (
    <div className="-mt-12 md:mt-0">
      {children}
      {types}
      {etypes}
    </div>
  );
}