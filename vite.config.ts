import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./server/local.js";
export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "dist" },
});
