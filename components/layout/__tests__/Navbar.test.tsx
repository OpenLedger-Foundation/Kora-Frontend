import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock env module to avoid environment variable parsing failure
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CBWOAOZCOAJQH7HHZRE5BVNL2C4HRP4JCQZF3YQCQYDL5BZJRN4YGK4A",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
  },
}));

import { ChangelogNavButton } from "../Navbar";

// Load actual message catalogs to guarantee real translation keys match
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import arMessages from "@/messages/ar.json";
import ptMessages from "@/messages/pt-BR.json";

const messagesByLocale: Record<string, any> = {
  en: enMessages,
  es: esMessages,
  ar: arMessages,
  "pt-BR": ptMessages,
};

let currentLocale = "en";

// Mock wallet assets to prevent StrKey checksum validation error in tests
vi.mock("@/config/walletAssets", () => ({
  TESTNET_USDC_ISSUER: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  TESTNET_EURC_ISSUER: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  WALLET_ASSETS: {
    usdc: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    eurc: { code: "EURC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  },
  DEFAULT_WALLET_ASSETS: [],
}));

// Mock next-intl to read from real message files
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => {
    const localeCatalog = messagesByLocale[currentLocale] || enMessages;
    if (namespace) {
      return localeCatalog[namespace]?.[key] ?? key;
    }
    return localeCatalog[key] ?? key;
  },
}));

// Mock uiStore
const mockSetChangelogOpen = vi.fn();
vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: any) =>
    selector({
      setChangelogOpen: mockSetChangelogOpen,
    }),
}));

// Mock useChangelogBadge hook
let mockHasUnread = false;
vi.mock("@/hooks/useChangelogBadge", () => ({
  useChangelogBadge: () => ({
    hasUnread: mockHasUnread,
  }),
}));

describe("ChangelogNavButton - i18n & a11y (Issue #964)", () => {
  beforeEach(() => {
    currentLocale = "en";
    mockHasUnread = false;
    mockSetChangelogOpen.mockClear();
  });

  describe("English locale", () => {
    it("renders read changelog button with localized aria-label and title", () => {
      mockHasUnread = false;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", { name: "Open changelog" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Open changelog");
      expect(button).toHaveAttribute("title", "Changelog");
      expect(screen.queryByTestId("changelog-unread-dot")).not.toBeInTheDocument();
    });

    it("renders unread changelog button with distinct unread aria-label", () => {
      mockHasUnread = true;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", {
        name: "Open changelog (new release available)",
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        "aria-label",
        "Open changelog (new release available)"
      );
      expect(screen.getByTestId("changelog-unread-dot")).toBeInTheDocument();
    });
  });

  describe("Arabic locale (RTL)", () => {
    beforeEach(() => {
      currentLocale = "ar";
    });

    it("renders localized Arabic aria-label when read", () => {
      mockHasUnread = false;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", { name: "فتح سجل التغييرات" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "فتح سجل التغييرات");
      expect(button).toHaveAttribute("title", "سجل التغييرات");
    });

    it("renders localized Arabic aria-label when unread", () => {
      mockHasUnread = true;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", {
        name: "فتح سجل التغييرات (إصدار جديد متاح)",
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        "aria-label",
        "فتح سجل التغييرات (إصدار جديد متاح)"
      );
    });
  });

  describe("Spanish and Portuguese locales", () => {
    it("renders localized Spanish aria-label", () => {
      currentLocale = "es";
      mockHasUnread = false;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", { name: "Abrir registro de cambios" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Abrir registro de cambios");
      expect(button).toHaveAttribute("title", "Registro de Cambios");
    });

    it("renders localized Spanish aria-label when unread", () => {
      currentLocale = "es";
      mockHasUnread = true;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", {
        name: "Abrir registro de cambios (nueva versión disponible)",
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        "aria-label",
        "Abrir registro de cambios (nueva versión disponible)"
      );
    });

    it("renders localized Brazilian Portuguese aria-label", () => {
      currentLocale = "pt-BR";
      mockHasUnread = false;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", { name: "Abrir registro de alterações" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Abrir registro de alterações");
      expect(button).toHaveAttribute("title", "Registro de Alterações");
    });

    it("renders localized Brazilian Portuguese aria-label when unread", () => {
      currentLocale = "pt-BR";
      mockHasUnread = true;
      render(<ChangelogNavButton />);

      const button = screen.getByRole("button", {
        name: "Abrir registro de alterações (nova versão disponível)",
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        "aria-label",
        "Abrir registro de alterações (nova versão disponível)"
      );
    });
  });

  describe("Interaction", () => {
    it("triggers setChangelogOpen(true) when clicked", () => {
      render(<ChangelogNavButton />);
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(mockSetChangelogOpen).toHaveBeenCalledWith(true);
    });
  });
});
