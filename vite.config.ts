import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

type ProxyEnvironment = { VITE_FASTAPI_PROXY_TARGET?: string };

export function selectApiProxyTarget(_requestPath: string, env: ProxyEnvironment = process.env): string {
  return env.VITE_FASTAPI_PROXY_TARGET || "http://127.0.0.1:8000";
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/api": selectApiProxyTarget("/api", { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env }),
    },
  },
}));
