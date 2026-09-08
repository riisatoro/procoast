import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_PROXY_TARGET || "http://localhost:8010";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3010,
    proxy: {
      "/api": { target: proxyTarget, changeOrigin: true },
      "/admin": { target: proxyTarget, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 3010,
    proxy: {
      "/api": { target: proxyTarget, changeOrigin: true },
      "/admin": { target: proxyTarget, changeOrigin: true },
    },
  },
});
