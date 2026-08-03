import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    // Prefer browser build; node entry breaks Vite CJS default interop (.init).
    alias: {
      arweave: "arweave/web/index.js",
    },
  },
  optimizeDeps: {
    include: ["arweave/web/index.js", "node-forge", "@scure/bip39", "@noble/hashes", "jspdf"],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Avoid circular async chunk with app entry (Safari: Importing a module script failed).
        manualChunks(id) {
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("node_modules/html2canvas") ||
            id.includes("node_modules/dompurify") ||
            id.includes("node_modules/canvg") ||
            id.includes("node_modules/fflate")
          ) {
            return "pdf-vendor";
          }
        },
      },
    },
  },
});
