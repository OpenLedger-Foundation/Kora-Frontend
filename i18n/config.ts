export const locales = ["en", "es", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
};
export const rtlLocales = ["ar"] as const;
export function isRTL(locale: string): locale is typeof rtlLocales[number] {
  return rtlLocales.includes(locale as any);
}
