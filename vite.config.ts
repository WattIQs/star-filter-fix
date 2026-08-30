// @lovable.dev/vite-tanstack-config provides the project's standard
// TanStack Start, React, Tailwind, path alias and Nitro integration.
// Vercel is detected explicitly so Nitro emits the Vercel Functions shape.
//
// No `external` entries here on purpose: marking packages external makes the
// server bundle rely on runtime module resolution, which breaks TanStack
// Start's internal `#tanstack-*` subpath imports on serverless targets
// (ERR_PACKAGE_IMPORT_NOT_DEFINED). Native/optional modules are loaded via a
// runtime-computed dynamic import instead (see src/lib/overture.server.ts).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = process.env.VERCEL === "1";

export default defineConfig({
  tanstackStart: {},
  nitro: isVercel ? { preset: "vercel" } : true,
});
