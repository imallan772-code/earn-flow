// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// Tailwind v4: keep `tailwindcss` + `@tailwindcss/vite` in devDependencies (Lovable peer deps).
// Lovable registers the plugin internally — do NOT add tailwindcss() to vite.plugins below.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico"],
        manifest: {
          name: "PHONARA",
          short_name: "PHONARA",
          description: "PHONARA — 매일 도파민 부수입",
          theme_color: "#0d0a1a",
          background_color: "#0d0a1a",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/favicon.ico",
              sizes: "64x64",
              type: "image/x-icon",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
        devOptions: { enabled: false },
      }),
    ],
  },
});
