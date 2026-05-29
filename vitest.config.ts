import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "**/__tests__/mocks/**"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
