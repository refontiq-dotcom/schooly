import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Équivalent ESM de __dirname (un fichier .mts est chargé comme module ES).
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(rootDir, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/lib/test/setup.ts",
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    css: true,
  },
});
