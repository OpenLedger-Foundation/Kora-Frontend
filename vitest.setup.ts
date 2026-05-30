import "@testing-library/jest-dom";
import path from "node:path";
import Module from "node:module";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./app/invoice/__tests__/mocks/server";

const moduleAny = Module as any;
const originalResolveFilename = moduleAny._resolveFilename;
moduleAny._resolveFilename = function patchedResolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(process.cwd(), request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  server.resetHandlers();
});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterAll(() => server.close());

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

global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => {
    const React = require("react");
    return React.createElement("img", { alt: alt ?? "", ...props });
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/invoice/create",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => {
    const React = require("react");
    return React.createElement("a", { href, ...rest }, children);
  },
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

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
    dismiss: vi.fn(),
  },
}));

if (typeof URL.createObjectURL === "undefined") {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:mock-url"),
    writable: true,
  });
}
