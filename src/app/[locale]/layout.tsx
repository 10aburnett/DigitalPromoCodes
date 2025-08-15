import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export const runtime = "nodejs";

// Generate static params for all supported locales
export function generateStaticParams() {
  return ["en","es","nl","fr","de","it","pt","zh"].map((locale) => ({ locale }));
}

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