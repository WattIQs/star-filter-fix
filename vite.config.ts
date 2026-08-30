// @lovable.dev/vite-tanstack-config provides the project's standard
// TanStack Start, React, Tailwind, path alias and Nitro integration.
// Vercel is detected explicitly so Nitro emits the Vercel Functions shape.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = process.env.VERCEL === "1";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        external: [
          "@duckdb/node-api",
          "@duckdb/node-bindings",
          "@duckdb/node-bindings-linux-x64",
        ],
      },
    },
  },
  nitro: {
    preset: isVercel ? "vercel" : "node-server",
  },
});
