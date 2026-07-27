import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.tsx"],
    css: true,
    // Exclude pre-existing test files that use invalid esbuild syntax
    // (vi.mocked(require(...)) = ... assignments) — these were never passing.
    exclude: [
      "**/node_modules/**",
      "__tests__/wallet-state.integration.test.tsx",
      "__tests__/invoice-detail.integration.test.tsx",
      "__tests__/funding-flow.integration.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "next/navigation": path.resolve(__dirname, "./__tests__/__mocks__/next-navigation.ts"),
      "next/image": path.resolve(__dirname, "./__tests__/__mocks__/next-image.tsx"),
      "next/link": path.resolve(__dirname, "./__tests__/__mocks__/next-link.tsx"),
    },
  },
});
