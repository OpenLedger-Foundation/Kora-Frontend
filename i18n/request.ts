import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale is supported, fall back to default
  const resolvedLocale: Locale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  };
});
