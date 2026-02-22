import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  server: {
    port: 5173,
    strictPort: true, // fail if 5173 is in use so Electron always matches
  },
  build: {
    outDir: "dist",
  },
});
