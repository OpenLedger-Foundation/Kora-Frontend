/**
 * Automated WCAG 2.1 AA accessibility tests using vitest-axe.
 *
 * These tests run axe-core against rendered components and pages to catch
 * contrast failures, missing labels, and other accessibility violations.
 *
 * Run: npx vitest run __tests__/accessibility/a11y.test.tsx
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "vitest-axe";

expect.extend(toHaveNoViolations);

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  const React = require("react");
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_t: any, tag: string) =>
          ({ children, ...props }: any) =>
            React.createElement(tag, props, children),
      }
    ),
    AnimatePresence: ({ children }: any) => children,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function expectNoA11yViolations(ui: React.ReactElement) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ── Badge components ──────────────────────────────────────────────────────────

import { Badge, RiskBadge } from "@/components/ui/badge";

describe("Badge — WCAG 2.1 AA", () => {
  it("default badge has no violations", async () => {
    await expectNoA11yViolations(<Badge>Default</Badge>);
  });

  it("success badge has no violations", async () => {
    await expectNoA11yViolations(<Badge variant="success">Repaid</Badge>);
  });

  it("warning badge has no violations", async () => {
    await expectNoA11yViolations(<Badge variant="warning">Pending</Badge>);
  });

  it("danger badge has no violations", async () => {
    await expectNoA11yViolations(<Badge variant="danger">Defaulted</Badge>);
  });

  it("info badge has no violations", async () => {
    await expectNoA11yViolations(<Badge variant="info">Listed</Badge>);
  });

  it("kora badge has no violations", async () => {
    await expectNoA11yViolations(<Badge variant="kora">12.50% APR</Badge>);
  });
});

describe("RiskBadge — WCAG 2.1 AA", () => {
  const tiers = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"] as const;

  tiers.forEach((tier) => {
    it(`RiskBadge tier=${tier} has no violations`, async () => {
      await expectNoA11yViolations(
        <RiskBadge tier={tier} tooltip={false} />
      );
    });
  });
});

// ── InvoiceStatusBadge ────────────────────────────────────────────────────────

import { InvoiceStatusBadge } from "@/components/invoice/InvoiceStatusBadge";
import type { InvoiceStatus } from "@/types";

describe("InvoiceStatusBadge — WCAG 2.1 AA", () => {
  const statuses: InvoiceStatus[] = [
    "draft",
    "pending_mint",
    "listed",
    "partially_funded",
    "fully_funded",
    "repaid",
    "defaulted",
    "cancelled",
  ];

  statuses.forEach((status) => {
    it(`status=${status} has no violations`, async () => {
      await expectNoA11yViolations(<InvoiceStatusBadge status={status} />);
    });
  });
});

// ── Button ────────────────────────────────────────────────────────────────────

import { Button } from "@/components/ui/button";

describe("Button — WCAG 2.1 AA", () => {
  it("primary button has no violations", async () => {
    await expectNoA11yViolations(<Button>Connect Wallet</Button>);
  });

  it("outline button has no violations", async () => {
    await expectNoA11yViolations(<Button variant="outline">Cancel</Button>);
  });

  it("ghost button has no violations", async () => {
    await expectNoA11yViolations(<Button variant="ghost">View</Button>);
  });

  it("danger button has no violations", async () => {
    await expectNoA11yViolations(<Button variant="danger">Delete</Button>);
  });

  it("disabled button has no violations", async () => {
    await expectNoA11yViolations(<Button disabled>Submit</Button>);
  });

  it("loading button has no violations", async () => {
    await expectNoA11yViolations(<Button isLoading>Submitting</Button>);
  });

  it("icon-only button has accessible label", async () => {
    await expectNoA11yViolations(
      <Button size="icon" iconLabel="Close dialog" aria-label="Close dialog" />
    );
  });
});

// ── StatCard ──────────────────────────────────────────────────────────────────

import { StatCard } from "@/components/ui/stat-card";

describe("StatCard — WCAG 2.1 AA", () => {
  it("basic stat card has no violations", async () => {
    await expectNoA11yViolations(
      <StatCard label="Total Financed" value="$125,000 USDC" />
    );
  });

  it("stat card with positive trend has no violations", async () => {
    await expectNoA11yViolations(
      <StatCard
        label="Active Invoices"
        value="12"
        valueRaw={12}
        trend={{ percentage: 8.5 }}
      />
    );
  });

  it("stat card with negative trend has no violations", async () => {
    await expectNoA11yViolations(
      <StatCard
        label="Repayment Rate"
        value="94%"
        trend={{ percentage: -2.1 }}
      />
    );
  });
});
