import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
    },
  },
  envDir: path.resolve(__dirname, "../.."),
  define: {
    "import.meta.env.VITE_ADMIN_ENABLED": JSON.stringify("true"),
  },
  server: { port: 5174, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
