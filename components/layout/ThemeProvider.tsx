"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";

/**
 * The resolved theme applied to <html> — never "system".
 * Consumers use this to render the correct icon without needing
 * to know about the "system" intermediate state.
 */
export type ResolvedTheme = "light" | "dark";

const ResolvedThemeContext = createContext<ResolvedTheme>("dark");

/** Returns the currently applied (resolved) theme — never "system". */
export function useResolvedTheme(): ResolvedTheme {
  return useContext(ResolvedThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const root = document.documentElement;

    const apply = (mode: ResolvedTheme) => {
      root.classList.remove("light", "dark");
      root.classList.add(mode);
      setResolved(mode);
    };

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) =>
        apply(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    apply(theme === "dark" ? "dark" : "light");
  }, [theme]);

  // Enable CSS transitions only after the first mount so the initial page
  // paint doesn't animate (avoids flash-of-transition on load).
  // The transition rule in globals.css is gated on [data-theme-ready].
  useEffect(() => {
    document.documentElement.dataset.themeReady = "true";
  }, []);

  return (
    <ResolvedThemeContext.Provider value={resolved}>
      {children}
    </ResolvedThemeContext.Provider>
  );
}
