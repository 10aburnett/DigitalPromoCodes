// server-only - Safe schema locale config that doesn't interfere with existing i18n
import 'server-only';

// Feature flag to enable/disable locale functionality completely
const LOCALE_ENABLED = process.env.SCHEMA_LOCALE_ENABLED === 'true';

// Conservative subset for schema markup only
export const LOCALES = ['en', 'de', 'sk'] as const;
export type Locale = typeof LOCALES[number];

export function isLocale(x?: string | null): x is Locale {
  if (!LOCALE_ENABLED) return x === 'en'; // When disabled, only 'en' is valid
  return !!x && (LOCALES as readonly string[]).includes(x);
}

export function getSchemaLocale(localeParam?: string | null): string {
  if (!LOCALE_ENABLED) return 'en'; // Always default to 'en' when disabled
  return isLocale(localeParam) ? localeParam : 'en';
}

export function isLocaleEnabled(): boolean {
  return LOCALE_ENABLED;
}