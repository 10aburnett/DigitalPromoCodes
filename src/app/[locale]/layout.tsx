import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const runtime = "nodejs";

export default function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={params.locale}>
      <body>
        <AuthProvider>
          <LanguageProvider locale={params.locale}>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </LanguageProvider>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
} 