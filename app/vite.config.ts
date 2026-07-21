/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  server: {
    /* PORT: harness-assigned (launch.json autoPort); 5173 otherwise */
    port: Number(process.env.PORT) || 5173,
    proxy: {
      /* TRAIL_API pairs a second web instance with a TRAIL_PORT sidecar */
      "/api": process.env.TRAIL_API ?? "http://localhost:5175"
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});
