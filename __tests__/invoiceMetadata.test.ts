import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TxSimulationPreview } from "../components/invoice/TxSimulationPreview";
import { verifyMetadataIntegrity } from "../lib/invoiceMetadata";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (!values) return key;
    return key.replace(/\{(.*?)\}/g, (_, group) => String(values[group] ?? `{${group}}`));
  },
}));

describe("TxSimulationPreview", () => {
  it("renders the successful simulation preview correctly", () => {
    render(
      <TxSimulationPreview
        open={true}
        preview={{
          feeStroops: 250,
          feeXlm: 0.000025,
          resourceFee: 250,
          cpuInstructions: 18_500,
          memoryBytes: 2048,
          readBytes: 512,
          writeBytes: 128,
        }}
        onProceed={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(screen.getByText("txSimulation.title")).toBeInTheDocument();
    expect(screen.getByText("250 stroops")).toBeInTheDocument();
    expect(screen.getByText("250 resource stroops")).toBeInTheDocument();
    expect(screen.getByText("18.5K")).toBeInTheDocument();
  });

  it("renders a simulation error state", () => {
    render(
      <TxSimulationPreview
        open={true}
        preview={{
          feeStroops: 0,
          feeXlm: 0,
          resourceFee: 0,
          cpuInstructions: 0,
          memoryBytes: 0,
          readBytes: 0,
          writeBytes: 0,
          error: "Not enough balance to simulate",
        }}
        onProceed={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(screen.getByText("txSimulation.simulationError")).toBeInTheDocument();
    expect(screen.getByText("Not enough balance to simulate")).toBeInTheDocument();
  });
});

describe("verifyMetadataIntegrity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when fetched metadata matches the local metadata", async () => {
    const metadata = { invoiceNumber: "INV-001", amount: 1000, issuer: { address: "GABC..." } };
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(metadata) })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyMetadataIntegrity("bafybeiexamplecid", metadata)).resolves.toBe(true);
  });

  it("returns false when fetched metadata differs from the local metadata", async () => {
    const localMetadata = { invoiceNumber: "INV-001", amount: 1000 };
    const remoteMetadata = { invoiceNumber: "INV-001", amount: 1200 };
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(remoteMetadata) })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyMetadataIntegrity("bafybeiexamplecid", localMetadata)).resolves.toBe(false);
  });
});
