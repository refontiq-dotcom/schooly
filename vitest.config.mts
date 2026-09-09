import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@schooly/ui": resolve(rootDir, "packages/ui/src"),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "ui",
          environment: "jsdom",
          globals: true,
          include: ["packages/ui/src/**/*.test.{ts,tsx}"],
          css: true,
        },
      },
      {
        test: {
          name: "db",
          environment: "node",
          globals: true,
          include: ["packages/db/tests/**/*.test.ts"],
        },
      },
    ],
  },
});
