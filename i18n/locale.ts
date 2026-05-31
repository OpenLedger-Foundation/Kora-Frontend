/**
 * Locale detection and persistence utilities.
 *
 * Priority order:
 *  1. localStorage (user's explicit choice)
 *  2. browser Accept-Language header (detected from navigator.language)
 *  3. default locale ("en")
 */
import { locales, defaultLocale, type Locale } from "./config";

const STORAGE_KEY = "kora-locale";

/** Detect the best locale from the browser's language preference. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;

  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of languages) {
    // Try exact match first (e.g. "es-MX" → "es")
    const base = lang.split("-")[0].toLowerCase() as Locale;
    if (locales.includes(base)) return base;
  }

  return defaultLocale;
}

/** Read the persisted locale from localStorage. */
export function getStoredLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && locales.includes(stored as Locale)) return stored as Locale;
  } catch {
    // localStorage may be blocked in some environments
  }
  return null;
}

/** Persist the user's locale choice to localStorage. */
export function setStoredLocale(locale: Locale): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

/** Resolve the active locale using the priority chain. */
export function resolveLocale(): Locale {
  return getStoredLocale() ?? detectBrowserLocale();
}
