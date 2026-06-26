"use client";

/**
 * Client-side locale provider.
 *
 * Wraps next-intl's NextIntlClientProvider and handles:
 *  - Initial locale resolution (localStorage → browser → default)
 *  - Locale switching with localStorage persistence
 *  - Exposing `useLocale` and `useSetLocale` to the component tree
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, locales, type Locale } from "./config";
import { resolveLocale, setStoredLocale } from "./locale";

// ─── Context ──────────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LocaleProviderProps {
  children: React.ReactNode;
  /** Pre-loaded messages for all supported locales, keyed by locale code. */
  allMessages: Record<Locale, Record<string, unknown>>;
}

export function LocaleProvider({ children, allMessages }: LocaleProviderProps) {
  // Start with the default to avoid hydration mismatch; resolve on mount.
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const resolved = resolveLocale();
    setLocaleState(resolved);
    setMounted(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    if (!locales.includes(next)) return;
    setLocaleState(next);
    setStoredLocale(next);
  }, []);

  const messages = allMessages[locale] ?? allMessages[defaultLocale];

  const contextValue = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale]
  );

  // Suppress hydration mismatch by not rendering locale-dependent content
  // until after mount (when we know the real locale).
  if (!mounted) {
    return (
      <LocaleContext.Provider value={contextValue}>
        <NextIntlClientProvider locale={defaultLocale} messages={allMessages[defaultLocale]}>
          {children}
        </NextIntlClientProvider>
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={contextValue}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Returns the currently active locale code. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Returns a setter to switch the active locale. */
export function useSetLocale(): (locale: Locale) => void {
  return useContext(LocaleContext).setLocale;
}
