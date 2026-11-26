/**
 * WalletConnectModal state matrix — Issue #1231.
 *
 * Every connect state is pinned through the optional Storybook seams on the
 * modal (no wallet extension or RPC needed). Each story documents the
 * accessibility contract for that state; `@storybook/addon-a11y` reports
 * violations in the panel and `play` functions assert the ARIA signals that
 * assistive technology depends on.
 */

import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import arMessages from "@/messages/ar.json";
import ptBRMessages from "@/messages/pt-BR.json";
import { useUIStore } from "@/store";
import type { WalletProviderHealth } from "@/hooks/useWallet";
import {
  WalletConnectModal,
  type WalletConnectModalProps,
} from "./WalletConnectModal";

const allMessages = {
  en: enMessages,
  es: esMessages,
  ar: arMessages,
  "pt-BR": ptBRMessages,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

type ExtensionWindow = Window & {
  freighter?: unknown;
  xBullSDK?: unknown;
  lobstr?: unknown;
};

interface WalletConnectFixtureProps extends WalletConnectModalProps {
  /** Simulate a viewport that can deep-link into a wallet app. */
  isMobile?: boolean;
}

/** Health probe used by all stories — deterministic, extension-independent. */
const healthyProviders = fn(async (walletId: string): Promise<WalletProviderHealth> => {
  const ready = ["freighter", "xbull", "lobstr", "albedo"].includes(walletId);
  return {
    id: walletId,
    installed: ready,
    state: ready ? "ready" : "missing",
    message: ready ? "Ready" : "Not installed",
  };
});

function WalletConnectFixture({
  isMobile = false,
  ...modalProps
}: WalletConnectFixtureProps) {
  // Keep the real uiStore trigger in the loop so focus management is exercised.
  useUIStore.setState({ walletModalOpen: true });

  const setExtension = (key: keyof ExtensionWindow, value: unknown) => {
    const target = window as ExtensionWindow;
    if (value === undefined) {
      delete target[key];
    } else {
      target[key] = value;
    }
  };

  setExtension("freighter", isMobile ? undefined : {});
  setExtension("xBullSDK", isMobile ? undefined : {});
  setExtension("lobstr", isMobile ? undefined : {});

  return (
    <LocaleProvider allMessages={allMessages}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectModal {...modalProps} />
      </QueryClientProvider>
    </LocaleProvider>
  );
}

const meta: Meta<typeof WalletConnectFixture> = {
  title: "Wallet/WalletConnectModal",
  component: WalletConnectFixture,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Connect-wallet dialog states. The dialog owns focus while open, exposes " +
          "a labelled title and description, marks in-flight work with `aria-busy`, " +
          "and announces retry/deep-link changes through live regions. Keep provider " +
          "order stable — keyboard users tab through it. See docs/design-system.md.",
      },
    },
    a11y: {
      test: "error",
      config: {
        rules: [
          { id: "aria-dialog-name", enabled: true },
          { id: "color-contrast", enabled: true },
          { id: "aria-valid-attr-value", enabled: true },
        ],
      },
    },
  },
  args: {
    probeProviderHealthOverride: healthyProviders,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Helper: Radix portals the dialog to document.body, not the canvas. */
const dialog = () => within(document.body).getByRole("dialog");

export const Idle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Default list of providers. Each action has an accessible label " +
          "(Connect / Install / Open …), status badges are decorative text, " +
          "and focus lands on the first enabled provider when the dialog opens.",
      },
    },
  },
  play: async () => {
    const root = dialog();
    await expect(root).toBeVisible();
    await expect(root.getAttribute("aria-busy")).not.toBe("true");
    await expect(
      within(root).getByRole("button", { name: /^Connect Freighter$/ })
    ).toBeVisible();
  },
};

export const Connecting: Story = {
  args: {
    initialWalletState: "connecting",
    initialActiveWallet: "freighter",
  },
  parameters: {
    docs: {
      description: {
        story:
          "In-flight connection. `aria-busy=true` tells screen readers the dialog " +
          "is updating; Escape is intentionally blocked so a signature cannot be " +
          "abandoned mid-flight. The spinner is `aria-hidden` because `aria-busy` " +
          "already conveys the state.",
      },
    },
  },
  play: async () => {
    const root = dialog();
    await expect(root).toHaveAttribute("aria-busy", "true");
    await userEvent.keyboard("{Escape}");
    await expect(dialog()).toBeVisible();
  },
};

export const Connected: Story = {
  args: {
    initialWalletState: "success",
    initialActiveWallet: "freighter",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Success confirmation. Uses the existing DialogTitle/DialogDescription " +
          "and a non-interactive check icon so the status is read once, not as a " +
          "duplicate live announcement.",
      },
    },
  },
  play: async () => {
    const root = dialog();
    await expect(within(root).getByText("Wallet connected")).toBeVisible();
    await expect(root).not.toHaveAttribute("aria-busy", "true");
  },
};

export const ConnectionError: Story = {
  args: {
    initialWalletState: "error",
    initialActiveWallet: "freighter",
    initialErrorMsg: "Connection failed. Please unlock your wallet and try again.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Failure + retry. The error is rendered as text next to the failing " +
          "provider (not only colour), and the Retry button carries an explicit " +
          "accessible name so it is discoverable by voice control.",
      },
    },
  },
  play: async () => {
    const root = dialog();
    await expect(
      within(root).getByText(
        "Connection failed. Please unlock your wallet and try again."
      )
    ).toBeVisible();
    await expect(within(root).getByRole("button", { name: /retry/i })).toBeVisible();
  },
};

export const ProviderHealthStates: Story = {
  args: {
    initialProviderHealth: {
      freighter: {
        id: "freighter",
        installed: true,
        state: "ready",
        message: "Ready",
      },
      xbull: {
        id: "xbull",
        installed: true,
        state: "locked",
        message: "Locked",
      },
      lobstr: {
        id: "lobstr",
        installed: true,
        state: "unsupported_network",
        message: "Wrong network",
      },
      albedo: {
        id: "albedo",
        installed: true,
        state: "error",
        message: "Health check failed",
      },
    } satisfies Record<string, WalletProviderHealth>,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Pre-connect health badges: ready, missing, locked, unsupported network " +
          "and error. Badge text is never colour-only. `missing` and " +
          "`unsupported_network` disable the action, so keyboard users do not " +
          "reach a control that cannot succeed.",
      },
    },
  },
  play: async () => {
    const root = dialog();
    await expect(within(root).getByText("Locked")).toBeVisible();
    await expect(within(root).getByText("Wrong network")).toBeVisible();
    await expect(within(root).getByText("Health check failed")).toBeVisible();
  },
};

export const MobileDeepLinkWaiting: Story = {
  args: {
    isMobile: true,
    initialWalletState: "connecting",
    initialActiveWallet: "freighter",
    initialWaitingForDeepLink: true,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        story:
          "Mobile deep-link hand-off. The waiting notice is `role=status` with " +
          "`aria-live=polite`, so returning to the wallet app announces that the " +
          "connection is still pending without stealing focus.",
      },
    },
  },
  play: async () => {
    const root = dialog();
    const status = within(root).getByRole("status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(status).toHaveTextContent("Waiting for wallet app to open.");
  },
};
