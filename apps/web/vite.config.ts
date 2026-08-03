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
    include: ["arweave/web/index.js", "node-forge", "@scure/bip39", "@noble/hashes"],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 700,
  },
});
