/**
 * Vitest setup file for integration tests
 * Configures jsdom environment, mocks, and global test utilities
 */

import * as React from "react";
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
const IntersectionObserverMock = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
  unobserve() {}
} as unknown as typeof globalThis.IntersectionObserver;

globalThis.IntersectionObserver = IntersectionObserverMock;

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: React.ComponentPropsWithoutRef<"img">) =>
    React.createElement("img", props),
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
