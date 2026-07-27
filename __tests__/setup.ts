/**
 * Test setup file with common utilities, mocks, and mock providers
 */

import { vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * Create a new QueryClient for each test to avoid cross-test cache pollution
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Mock next/navigation for client components
 */
export function setupNextNavigationMocks() {
  vi.mock("next/navigation", () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    })),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    usePathname: vi.fn(() => "/"),
    useParams: vi.fn(() => ({})),
  }));

  // Return the mocked module so callers can spy on individual functions
  return {
    useRouter: vi.fn(),
    useSearchParams: vi.fn(),
    usePathname: vi.fn(),
    useParams: vi.fn(),
  };
}

/**
 * Mock framer-motion to avoid animation complications in tests
 */
export function setupFramerMotionMocks() {
  vi.mock("framer-motion", () => ({
    motion: {
      div: ({ children, ...props }: any) => {
        const { div: Div } = require("react");
        return Div({ ...props }, children);
      },
    },
    AnimatePresence: ({ children }: any) => children,
  }));
}

/**
 * Mock sonner toast notifications
 */
export function setupSonnerMocks() {
  vi.mock("sonner", () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
      promise: vi.fn(),
    },
  }));
}
