import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Absolute base avoids broken ./asset paths when the site is opened
// without a trailing slash. Single bundle avoids circular chunk imports
// (wallet → index → wallet) that surface as "Importing a module script failed".
export default defineConfig({
  base: "/Sejire_arweave/",
  plugins: [react()],
  optimizeDeps: {
    include: ["arweave", "node-forge", "@scure/bip39", "@noble/hashes"],
  },
  build: {
    cssCodeSplit: false,
    modulePreload: false,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Keep one JS file for GitHub Pages reliability.
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
