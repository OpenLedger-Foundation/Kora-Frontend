export const locales = ["en", "es", "ar", "pt-BR"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
  "pt-BR": "Português (BR)",
};
export const rtlLocales = ["ar"] as const;
export function isRTL(locale: string): locale is typeof rtlLocales[number] {
  return rtlLocales.includes(locale as any);
}
