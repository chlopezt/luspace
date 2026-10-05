import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./server/local.js";
const buildId = Date.now().toString(36);
export default defineConfig({
  define: { __LUSPACE_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), localApiPlugin(), {
    name: 'luspace-build-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ version: buildId }) }); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/app-version.json') return next();
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ version: buildId }));
      });
    },
  }],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "dist" },
});
