import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";
import { InstallPrompt } from "./InstallPrompt";

const messages = {
  installPrompt: {
    ariaLabel: "Install Kora Protocol app",
    iconAlt: "Kora Protocol icon",
    description: "Install Kora for faster access and offline support.",
    dismissLabel: "Dismiss install prompt",
    install: "Install",
    notNow: "Not now",
    addToHomeScreen: "Add to Home Screen",
  },
};

type PromptOutcome = "accepted" | "dismissed" | "failed";

function IntlWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

// Simulate `beforeinstallprompt` firing so the banner becomes visible.
// The component listens for the native event; we dispatch a synthetic one
// that carries the minimal shape InstallPrompt expects (preventDefault + prompt).
//
// `outcome` drives the resolved `userChoice` so the analytics path exercised by
// `lib/installPromptAnalytics.ts` can be demonstrated for each terminal state:
//   - "accepted": user installs the app
//   - "dismissed": user dismisses the native prompt
//   - "failed":   prompt() rejects (degraded/offline browser behavior)
function FireInstallPrompt({ outcome = "accepted" }: { outcome?: PromptOutcome }) {
  useEffect(() => {
    // Give InstallPrompt time to register its listener (effect runs after mount)
    const timer = setTimeout(() => {
      const evt = new Event("beforeinstallprompt") as unknown as Event & {
        platforms: string[];
        userChoice: Promise<{ outcome: string; platform: string }>;
        prompt: () => Promise<void>;
      };
      evt.platforms = ["web"];
      evt.userChoice =
        outcome === "failed"
          ? Promise.reject(new Error("prompt failed"))
          : Promise.resolve({ outcome, platform: "web" });
      evt.prompt =
        outcome === "failed"
          ? async () => {
              throw new Error("prompt failed");
            }
          : async () => {};
      // beforeinstallprompt is cancelable — mimic that
      Object.defineProperty(evt, "cancelable", { value: true });
      evt.preventDefault = () => {};
      window.dispatchEvent(evt);
      // 2nd visit path shows immediately; force visit count >=2 so no 30s timer
      try {
        localStorage.setItem("kora-pwa-visit-count", "2");
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [outcome]);
  return null;
}

const meta: Meta<typeof InstallPrompt> = {
  title: "PWA/InstallPrompt",
  component: InstallPrompt,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "PWA Add-to-Home-Screen banner. Visible state is tested in Vitest (`__tests__/install-prompt.test.tsx`); axe coverage is documented via the a11y notes below. Primary actions (Install / Not now) carry explicit accessible names (`aria-label`) and the dialog has `aria-label=\"Install Kora Protocol app\"` so axe does not flag missing names.\n\n" +
          "**Analytics (privacy-safe).** Install prompt outcomes (`shown`, `accepted`, `dismissed`, `failed`) are emitted through `lib/installPromptAnalytics.ts`. Events are gated by the `NEXT_PUBLIC_PWA_INSTALL_ANALYTICS` env flag (defaults to off when unset) and carry no PII — only the outcome, platform bucket, and a coarse viewport class. See the `Analytics*` stories below to preview each terminal state.",
      },
    },
    a11y: {
      // Storybook a11y addon should not flag the fixed-position banner as
      // outside landmarks — it is intentionally overlayed.
      config: { rules: [{ id: "aria-dialog-name", enabled: true }] },
    },
  },
  decorators: [
    (Story) => (
      <IntlWrapper>
        <div className="relative h-[280px] w-[420px] bg-zinc-950 p-4">
          <Story />
        </div>
      </IntlWrapper>
    ),
  ],
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof InstallPrompt>;

/** Default hidden state — no `beforeinstallprompt` fired, so nothing renders. */
export const Hidden: Story = {
  render: () => (
    <>
      <p className="text-sm text-zinc-400">
        InstallPrompt is hidden until the browser fires <code>beforeinstallprompt</code>.
      </p>
      <InstallPrompt />
    </>
  ),
};

/** Visible banner after `beforeinstallprompt` (2nd-visit path, no 30s delay). */
export const Visible: Story = {
  render: () => (
    <>
      <FireInstallPrompt />
      <InstallPrompt />
    </>
  ),
  play: async () => {
    // Give the component time to process the synthetic event before a11y checks run
    await new Promise((r) => setTimeout(r, 200));
  },
};

/** Dismissed state — banner shown then dismissed via the × or “Not now” action. */
export const Dismissed: Story = {
  render: () => {
    useEffect(() => {
      try {
        const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem("kora-pwa-install-dismissed-until", String(until));
      } catch {}
    }, []);
    return (
      <>
        <p className="text-sm text-zinc-400">
          Suppressed for 7 days via <code>localStorage</code> — banner does not render.
        </p>
        <InstallPrompt />
      </>
    );
  },
};

/**
 * Analytics: accepted outcome. The synthetic `beforeinstallprompt` resolves
 * `userChoice` with `outcome: "accepted"`, exercising the privacy-safe
 * `install_prompt_accepted` event path in `lib/installPromptAnalytics.ts`.
 * Screenshot-friendly visible banner for PR evidence.
 */
export const AnalyticsAccepted: Story = {
  render: () => (
    <>
      <FireInstallPrompt outcome="accepted" />
      <InstallPrompt />
    </>
  ),
  play: async () => {
    await new Promise((r) => setTimeout(r, 200));
  },
};

/**
 * Analytics: dismissed outcome. `userChoice` resolves with `outcome: "dismissed"`,
 * exercising the `install_prompt_dismissed` event path.
 */
export const AnalyticsDismissed: Story = {
  render: () => (
    <>
      <FireInstallPrompt outcome="dismissed" />
      <InstallPrompt />
    </>
  ),
  play: async () => {
    await new Promise((r) => setTimeout(r, 200));
  },
};

/**
 * Analytics: failed outcome. `prompt()` rejects (degraded/offline browser
 * behavior), exercising the `install_prompt_failed` event path. The banner
 * remains visible so the user can retry.
 */
export const AnalyticsFailed: Story = {
  render: () => (
    <>
      <FireInstallPrompt outcome="failed" />
      <InstallPrompt />
    </>
  ),
  play: async () => {
    await new Promise((r) => setTimeout(r, 200));
  },
};
