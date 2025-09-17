import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import polyfillNode from "rollup-plugin-polyfill-node";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["buffer", "process", "util"],
  },
  build: {
    rollupOptions: {
      plugins: [polyfillNode()], // Adds Node.js polyfills in browser
    },
  },
  define: {
    "process.env": {}, // Prevent process undefined errors
    global: "globalThis", // Polyfill global
  },
});
