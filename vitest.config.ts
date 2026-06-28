import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
