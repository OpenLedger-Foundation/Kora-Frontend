import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMaturityReminder } from "../useMaturityReminder";
import { useFundingReminder } from "../useFundingReminder";
import { useRepaymentReminder } from "../useRepaymentReminder";
import { useSettingsStore, DEFAULT_NOTIFICATION_PREFS } from "../../store/settingsStore";
import { useToast } from "@/hooks/useToast";
import type { Invoice } from "../../types/invoice";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://ipfs.io/ipfs/",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/useToast", () => {
  const success = vi.fn();
  const error = vi.fn();
  const dismiss = vi.fn();
  return {
    useToast: () => ({
      success,
      error,
      dismiss,
    }),
  };
});

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    tokenId: "token-1",
    ownerAddress: "owner-1",
    status: "listed",
    createdAt: "2026-07-01",
    terms: {
      apr: 0.1,
      discountRate: 0.05,
      repaymentDate: "", // set dynamically in tests
      minInvestment: 100,
      maxInvestment: 1000,
    },
    funding: {
      totalRaised: 500,
      fundingProgress: 0.5,
    },
    metadata: {
      invoiceNumber: "INV-001",
      debtorName: "Debtor 1",
      debtorAddress: "Address 1",
      amount: 1000,
      dueDate: "2026-08-01",
      jurisdiction: "US",
      category: "tech",
    },
  },
];

describe("Reminder preferences hooks gating tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.setState({
      notifications: { ...DEFAULT_NOTIFICATION_PREFS },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("useMaturityReminder", () => {
    it("fires maturity reminder when preference is ON and daysLeft matches", () => {
      const date = new Date();
      date.setDate(date.getDate() + 3);
      const invoice = {
        ...mockInvoices[0],
        terms: {
          ...mockInvoices[0].terms,
          repaymentDate: date.toISOString().split("T")[0],
        },
      };

      renderHook(() => useMaturityReminder([invoice]));

      const toast = useToast();
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("matures in 3 days"),
        undefined,
        "maturityReminder",
        "maturityReminder"
      );
    });

    it("does NOT fire maturity reminder when preference is OFF", () => {
      useSettingsStore.setState({
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFS,
          maturityReminder: false,
        },
      });

      const date = new Date();
      date.setDate(date.getDate() + 3);
      const invoice = {
        ...mockInvoices[0],
        terms: {
          ...mockInvoices[0].terms,
          repaymentDate: date.toISOString().split("T")[0],
        },
      };

      renderHook(() => useMaturityReminder([invoice]));

      const toast = useToast();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("actively dismisses active maturity reminders when preference is toggled OFF", () => {
      useSettingsStore.setState({
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFS,
          maturityReminder: true,
        },
      });

      renderHook(() => useMaturityReminder([]));

      act(() => {
        useSettingsStore.setState({
          notifications: {
            ...DEFAULT_NOTIFICATION_PREFS,
            maturityReminder: false,
          },
        });
      });

      const toast = useToast();
      expect(toast.dismiss).toHaveBeenCalledWith("maturityReminder");
    });
  });

  describe("useFundingReminder", () => {
    it("fires funding reminder when preference is ON and invoice is fully funded", () => {
      const invoice: Invoice = {
        ...mockInvoices[0],
        status: "fully_funded",
        funding: {
          totalRaised: 1000,
          fundingProgress: 1.0,
        },
      };

      renderHook(() => useFundingReminder([invoice]));

      const toast = useToast();
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("is fully funded"),
        undefined,
        "fundingAlert",
        "invoiceFunded"
      );
    });

    it("does NOT fire funding reminder when preference is OFF", () => {
      useSettingsStore.setState({
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFS,
          fundingAlerts: false,
        },
      });

      const invoice: Invoice = {
        ...mockInvoices[0],
        status: "fully_funded",
        funding: {
          totalRaised: 1000,
          fundingProgress: 1.0,
        },
      };

      renderHook(() => useFundingReminder([invoice]));

      const toast = useToast();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("actively dismisses funding reminders when preference is toggled OFF", () => {
      useSettingsStore.setState({
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFS,
          fundingAlerts: true,
        },
      });

      renderHook(() => useFundingReminder([]));

      act(() => {
        useSettingsStore.setState({
          notifications: {
            ...DEFAULT_NOTIFICATION_PREFS,
            fundingAlerts: false,
          },
        });
      });

      const toast = useToast();
      expect(toast.dismiss).toHaveBeenCalledWith("fundingAlert");
    });
  });

  describe("useRepaymentReminder", () => {
    it("fires repayment reminder when preference is ON and invoice is due/overdue", () => {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      const invoice: Invoice = {
        ...mockInvoices[0],
        status: "fully_funded",
        terms: {
          ...mockInvoices[0].terms,
          repaymentDate: date.toISOString().split("T")[0],
        },
      };

      renderHook(() => useRepaymentReminder([invoice]));

      const toast = useToast();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("is due or overdue for repayment"),
        undefined,
        undefined,
        "repaymentAlert",
        "yieldAvailable"
      );
    });

    it("does NOT fire repayment reminder when preference is OFF", () => {
      useSettingsStore.setState({
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFS,
          repaymentAlerts: false,
        },
      });

      const date = new Date();
      date.setDate(date.getDate() - 1);
      const invoice: Invoice = {
        ...mockInvoices[0],
        status: "fully_funded",
        terms: {
          ...mockInvoices[0].terms,
          repaymentDate: date.toISOString().split("T")[0],
        },
      };

      renderHook(() => useRepaymentReminder([invoice]));

      const toast = useToast();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("actively dismisses repayment reminders when preference is toggled OFF", () => {
      useSettingsStore.setState({
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFS,
          repaymentAlerts: true,
        },
      });

      renderHook(() => useRepaymentReminder([]));

      act(() => {
        useSettingsStore.setState({
          notifications: {
            ...DEFAULT_NOTIFICATION_PREFS,
            repaymentAlerts: false,
          },
        });
      });

      const toast = useToast();
      expect(toast.dismiss).toHaveBeenCalledWith("repaymentAlert");
    });
  });

  describe("Settings store persistence and verification", () => {
    it("persists settings correctly", () => {
      useSettingsStore.getState().setNotifications({ maturityReminder: false });
      expect(useSettingsStore.getState().notifications.maturityReminder).toBe(false);
    });

    it("loads default values correctly", () => {
      const { notifications } = useSettingsStore.getState();
      expect(notifications.maturityReminder).toBe(true);
      expect(notifications.fundingAlerts).toBe(true);
      expect(notifications.repaymentAlerts).toBe(true);
    });
  });
});
