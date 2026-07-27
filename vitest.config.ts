import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { config as loadDotenv } from "dotenv";
import { transformWithEsbuild } from "vite";

// Load .env.local then .env so test env vars are available.
// Replaces the @next/env loadEnvConfig call which triggers an ERR_REQUIRE_ESM
// error when vitest loads the config via CJS interop (vitest >= 2 + std-env ESM).
loadDotenv({ path: ".env.local", override: false });
loadDotenv({ path: ".env", override: false });

export default defineConfig({
  plugins: [
    {
      name: "compile-jsx-for-vitest",
      async transform(code, id) {
        if (id.endsWith(".tsx") || id.endsWith(".jsx")) {
          return transformWithEsbuild(code, id, {
            loader: id.endsWith(".tsx") ? "tsx" : "jsx",
            jsx: "automatic",
          });
        }
        return null;
      },
    },
    react(),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/e2e/**",
      "**/stories.snapshot.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
