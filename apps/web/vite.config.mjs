import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const certDir = path.resolve(import.meta.dirname, "certs");
const pfxPath = path.join(certDir, "callinsight-local.pfx");
const httpsConfig = fs.existsSync(pfxPath)
  ? {
      pfx: fs.readFileSync(pfxPath),
      passphrase: process.env.VITE_HTTPS_PASSPHRASE ?? "callinsight-local",
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    https: httpsConfig,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_PROXY_TARGET ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    https: httpsConfig,
  },
});
