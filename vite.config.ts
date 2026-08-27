// @lovable.dev/vite-tanstack-config already includes the standard TanStack Start,
// React, Tailwind, path alias and Nitro integration used by Lovable.
// For self-hosted Node platforms such as Render, explicitly target Nitro's
// node-server preset so the generated .output/server/index.mjs is executable
// by Node and listens through the platform-provided PORT.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
    preset: "node-server",
    output: {
      dir: ".output",
    },
  },
});