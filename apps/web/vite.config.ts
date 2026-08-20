import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** ArNS path manifests treat 404.html as SPA fallback (trailing-slash / deep links). */
function spaFallback404(): Plugin {
  return {
    name: "spa-fallback-404",
    closeBundle() {
      const index = resolve(__dirname, "dist/index.html");
      const fallback = resolve(__dirname, "dist/404.html");
      if (existsSync(index)) copyFileSync(index, fallback);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), spaFallback404()],
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
          // Keep Arweave/forge off the UI entry and never lazy-import them:
          // a lazy wallet chunk that imports back from index.html's entry
          // fails on ArNS with "Failed to fetch dynamically imported module".
          if (id.includes("node_modules/arweave") || id.includes("node_modules/node-forge")) {
            return "wallet";
          }
        },
      },
    },
  },
});
