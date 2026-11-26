import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { NetworkStatusBanner } from "../NetworkStatusBanner";

const network = vi.hoisted(() => ({ isOnline: true, health: { overall: "checking" } }));
vi.mock("@/hooks/useNetworkStatus", () => ({ useNetworkStatus: () => network }));

it("announces offline and outage separately and clears on recovery", () => {
  const banner = () => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <NetworkStatusBanner />
    </NextIntlClientProvider>
  );
  const { rerender } = render(banner());
  const status = screen.getByRole("status");
  expect(status).toBeEmptyDOMElement();
  network.isOnline = false;
  rerender(banner());
  expect(status).toHaveTextContent(messages.network.offlineDesc);
  network.isOnline = true;
  network.health.overall = "down";
  rerender(banner());
  expect(status).toHaveTextContent(messages.network.serviceUnavailable);
  network.health.overall = "operational";
  rerender(banner());
  expect(status).toBeEmptyDOMElement();
});
