"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Store,
  PlusCircle,
  BarChart3,
  Menu,
  X,
  Sun,
  Moon,
  History,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

const AddressBook = dynamic(
  () => import("@/components/wallet/AddressBook").then((m) => m.AddressBook),
  { ssr: false }
);

import { WalletButton } from "@/components/wallet/WalletButton";
import { NetworkStatusIndicator } from "@/components/layout/NetworkStatusIndicator";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

const MENU_ID = "mobile-nav-menu";

export function Navbar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const navRef = useRef<HTMLElement>(null);
  const [addressBookOpen, setAddressBookOpen] = useState(false);

  // Nav links defined inside component so labels are translated
  const NAV_LINKS = [
    { href: "/marketplace", label: t("marketplace"), icon: Store },
    { href: "/dashboard/investor", label: t("invest"), icon: BarChart3 },
    { href: "/dashboard/sme", label: t("myInvoices"), icon: LayoutDashboard },
    { href: "/invoice/create", label: t("createInvoice"), icon: PlusCircle },
    { href: "/transactions", label: t("history"), icon: History },
  ];

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            K
          </div>
          <span className="text-base font-semibold text-foreground">Kora</span>
          <span className="hidden rounded bg-kora-muted px-1.5 py-0.5 text-[10px] font-medium text-primary sm:block">
            {t("testnet")}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-muted"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <NetworkStatusIndicator />

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={
              theme === "dark" ? t("switchToLight") : t("switchToDark")
            }
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={() => setAddressBookOpen(true)}
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:block"
          >
            {t("addressBook")}
          </button>

          <WalletButton />

          {/* Hamburger — mobile only */}
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileOpen}
            aria-controls={MENU_ID}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id={MENU_ID}
            role="navigation"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border bg-background md:hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}

              <div className="pt-2 border-t border-border space-y-2">
                <WalletButton />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {addressBookOpen && (
        <AddressBook onClose={() => setAddressBookOpen(false)} />
      )}
    </header>
  );
}
