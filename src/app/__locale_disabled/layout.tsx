import { Inter } from 'next/font/google';
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { notFound } from 'next/navigation';
import { languageKeys } from '@/lib/i18n';

const inter = Inter({ subsets: ['latin'] });

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export async function generateStaticParams() {
  // Generate params for all non-English languages
  return languageKeys.filter(locale => locale !== 'en').map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: LocaleLayoutProps) {
  // Use the same language codes as defined in i18n
  const validLanguageCodes = languageKeys.filter(lang => lang !== 'en');
  
  // If it's not one of our supported language codes, return not found
  if (!validLanguageCodes.includes(locale as any)) {
    notFound();
  }

  return (
    <AuthProvider>
      <LanguageProvider locale={locale}>
        <ThemeProvider>
            {children}
        </ThemeProvider>
      </LanguageProvider>
      <Toaster position="top-right" />
    </AuthProvider>
  );
} 