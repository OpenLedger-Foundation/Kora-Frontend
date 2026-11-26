/**
 * Marketplace indexer freshness watermark (#1244).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      fresh: "Indexer synced {time}",
      stale: "Indexer data stale — last synced {time}",
    };
    return (key: string, values?: Record<string, string | number>) => {
      let out = messages[key] ?? key;
      for (const [k, v] of Object.entries(values ?? {})) {
        out = out.replace(`{${k}}`, String(v));
      }
      return out;
    };
  },
}));

const { freshness } = vi.hoisted(() => ({ freshness: vi.fn() }));
vi.mock("@/hooks/useIndexerStaleness", () => ({
  useIndexerStaleness: () => freshness(),
}));

import { IndexerStaleWatermark } from "@/components/marketplace/IndexerStaleWatermark";

describe("IndexerStaleWatermark", () => {
  beforeEach(() => {
    freshness.mockReset();
  });

  it("renders nothing before the indexer has ever synced", () => {
    freshness.mockReturnValue({
      lastSyncedAt: null,
      ageMs: null,
      isStale: false,
    });

    const { container } = render(<IndexerStaleWatermark />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a subtle fresh indicator after a recent sync", () => {
    freshness.mockReturnValue({
      lastSyncedAt: Date.now() - 30_000,
      ageMs: 30_000,
      isStale: false,
    });

    render(<IndexerStaleWatermark />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-stale", "false");
    expect(status).toHaveTextContent("Indexer synced");
  });

  it("warns when indexed availability is stale", () => {
    freshness.mockReturnValue({
      lastSyncedAt: Date.now() - 10 * 60_000,
      ageMs: 10 * 60_000,
      isStale: true,
    });

    render(<IndexerStaleWatermark />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-stale", "true");
    expect(status).toHaveTextContent("Indexer data stale");
  });
});
