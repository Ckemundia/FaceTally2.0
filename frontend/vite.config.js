import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import polyfillNode from "rollup-plugin-polyfill-node";
import path from "path";   // 👈 add this

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // 👈 alias for "@/..."
    },
  },
  optimizeDeps: {
    include: ["buffer", "process", "util"],
  },
  build: {
    rollupOptions: {
      plugins: [polyfillNode()],
    },
  },
  define: {
    "process.env": {},
    global: "globalThis",
  },
  server: {
    proxy: {
      "/api": {
        target: "https://facetally-backend-latest.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },

});
