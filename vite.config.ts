// @lovable.dev/vite-tanstack-config already includes the standard TanStack Start,
// React, Tailwind, path alias and Nitro integration used by Lovable.
// Render runs the Nitro node-server preset; Vercel needs Nitro's Vercel
// preset so TanStack Start's virtual entry modules are packaged correctly.
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
    output: {
      dir: ".output",
    },
  },
});
