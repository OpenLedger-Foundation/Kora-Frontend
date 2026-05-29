/**
 * Vitest setup file for integration tests
 * Configures jsdom environment, mocks, and global test utilities
 */

import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window.matchMedia for responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock sonner toast by default
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
  },
}));

// Add custom matchers if needed
expect.extend({});
import "@testing-library/jest-dom";
import { afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./app/invoice/__tests__/mocks/server";

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Global browser API stubs ──────────────────────────────────────────────────

// next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/invoice/create",
  useSearchParams: () => new URLSearchParams(),
}));

// next/link — render as plain anchor (no JSX in .ts file; use createElement)
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => {
    const React = require("react");
    return React.createElement("a", { href, ...rest }, children);
  },
}));

// framer-motion — passthrough to avoid animation complexity in tests
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

// sonner toast — no-op
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// URL.createObjectURL — not available in jsdom
if (typeof URL.createObjectURL === "undefined") {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:mock-url"),
    writable: true,
  });
}
