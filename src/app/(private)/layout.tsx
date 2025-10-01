import type { Metadata } from 'next';
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConditionalLayout } from '@/components/ConditionalLayout';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, noimageindex: true, nosnippet: true },
};

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <ConditionalLayout faviconUrl="/favicon.ico">
              {children}
            </ConditionalLayout>
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
      <Toaster position="top-right" />
    </>
  );
}
