import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const isRender = Boolean(process.env.RENDER);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: ["@tanstack/start-server-core"],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
      preset: isRender ? "node-server" : "vercel",
      noExternals: isRender,
    }),
    viteReact(),
  ],
});
