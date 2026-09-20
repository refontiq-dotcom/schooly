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
      {
        // Tests unitaires de l'app admin (server actions, helpers…).
        // L'alias « @ » reproduit celui de apps/schooly/tsconfig.json.
        resolve: {
          alias: [
            { find: /^@\/(.*)$/, replacement: `${resolve(rootDir, "apps/schooly/src")}/$1` },
          ],
          // Le lockfile installe react 19.2.8 (épinglé par les workspaces)
          // dans apps/schooly/node_modules ET react 19.3.0 à la racine (dep
          // transitive). Sans dedupe, deux copies coexistent au rendu des
          // tests (@radix-ui et next à la racine vs react-dom de l'app) et
          // React lève « Cannot read properties of null (reading
          // 'useContext' | 'useCallback') ». Le dedupe force une résolution
          // unique à la racine pour tous les modules transformés.
          dedupe: ["react", "react-dom"],
        },
        test: {
          name: "schooly",
          environment: "node",
          globals: true,
          include: ["apps/schooly/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});

